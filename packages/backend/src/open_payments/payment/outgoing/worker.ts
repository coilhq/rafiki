import { Knex } from 'knex'

import { ServiceDependencies } from './service'
import { OutgoingPayment, OutgoingPaymentState } from './model'
import { LifecycleError, PaymentError } from './errors'
import * as lifecycle from './lifecycle'
import { PaymentMethodHandlerError } from '../../../payment-method/handler/errors'
import { trace, Span } from '@opentelemetry/api'

// First retry waits 10 seconds, second retry waits 20 (more) seconds, etc.
export const RETRY_BACKOFF_SECONDS = 10

const MAX_STATE_ATTEMPTS = 5
let ATTEMPT_COUNTER = 0
const WORKER_CACHE_ONLY = true

// Cached Completed Payments:
let LAST_CHECKIN = Date.now()
let BUSY_PROCESSING = false

// Returns the id of the processed payment (if any).
export async function processPendingPayment(
  deps_: ServiceDependencies
): Promise<string | undefined> {
  const tracer = trace.getTracer('outgoing_payment_worker')
  return tracer.startActiveSpan(
    'outgoingPaymentLifecycle',
    async (span: Span) => {
      const stopTimer = deps_.telemetry?.startTimer('processPendingPayment', {
        callName: 'processPendingPayment'
      })
      // Continue to Process Pending:
      const paymentId = await deps_.knex.transaction(async (trx) => {
        const payment = await getPendingPayment(trx, deps_)
        if (!payment) return

        await handlePaymentLifecycle(
          {
            ...deps_,
            knex: trx,
            logger: deps_.logger.child({
              payment: payment.id,
              from_state: payment.state
            })
          },
          payment
        )
        return payment.id
      })

      /*deps_.logger.info(
        {
          busyProcessing: BUSY_PROCESSING,
          toBeCompletedSize: deps_.toBeCompleted.length
        },
        'JASON: Lets process worker complete cache.'
      )*/

      // Mark Completed
      if (readyToProcessCacheCompletedPayments(deps_)) {
        const stopTimerComplPay = deps_.telemetry?.startTimer(
          'getPendingPayment',
          {
            callName: 'workerCompleteCachedOutgoingPayments'
          }
        )
        await deps_.knex.transaction(async (trx) => {
          await processCacheCompletedPayments(trx, deps_)
        })
        stopTimerComplPay && stopTimerComplPay()
      }

      stopTimer && stopTimer()
      span.end()
      return paymentId
    }
  )
}

function readyToProcessCacheCompletedPayments(
  deps: ServiceDependencies
): boolean {
  if (BUSY_PROCESSING) return false
  BUSY_PROCESSING = true

  if (!deps.toBeCompleted.length) {
    BUSY_PROCESSING = false
    return false
  }

  const diff = Date.now() - LAST_CHECKIN
  if (diff > 5000 || deps.toBeCompleted.length > 200) return true

  BUSY_PROCESSING = false
  return false
}

async function processCacheCompletedPayments(
  trx: Knex.Transaction,
  deps: ServiceDependencies
): Promise<void> {
  try {
    if (!deps.toBeCompleted.length) return

    /*deps.logger.info(
      {
        busyProcessing: BUSY_PROCESSING,
        now: new Date(Date.now()),
        lastCheckin: new Date(LAST_CHECKIN),
        letsProcess: 'Yes!!!!!!!!!!!!',
        toBeCompleted: deps.toBeCompleted.length
      },
      'JASON: Finally! '
    )*/

    const state = OutgoingPaymentState.Completed

    let inValue = ''
    let toUpdate
    while ((toUpdate = deps.toBeCompleted.shift())) {
      inValue += `'${toUpdate}',`
      /*const outPay = await OutgoingPayment.query(trx)
        .findOne({ id: toUpdate })
        .forUpdate()
        .skipLocked()
      if (!outPay) {
        deps.toBeCompleted.push(toUpdate)
        continue
      }
      await outPay.$query(trx).patch({ state })*/
    }
    inValue = inValue.substring(0, inValue.length - 1)
    await trx.raw(
      `UPDATE "outgoingPayments" SET state = '${state}' WHERE id IN(${inValue})`
    )
    await trx.commit()
  } catch (err) {
    await trx.rollback()
    throw err
  } finally {
    BUSY_PROCESSING = false
    LAST_CHECKIN = Date.now()
  }
}

// Fetch (and lock) a payment for work.
async function getPendingPayment(
  trx: Knex.Transaction,
  deps: ServiceDependencies
): Promise<OutgoingPayment | undefined> {
  const now = new Date(Date.now()).toISOString()
  const availSending = deps.sendingOutgoing.shift()
  if (availSending) {
    const stopTimerCache = deps.telemetry?.startTimer('getPendingPayment', {
      callName: 'getPendingPayment_Cache'
    })
    const fromCache = (await deps.cacheDataStore.get(
      availSending
    )) as OutgoingPayment
    if (fromCache) {
      await deps.quoteService.setOn(fromCache)
      await deps.walletAddressService.setOn(fromCache)
      stopTimerCache && stopTimerCache()
      return fromCache
    }
  }

  ATTEMPT_COUNTER++
  if (WORKER_CACHE_ONLY && ATTEMPT_COUNTER < 100) {
    // TODO for now, simply wait for the next payment. We only rely on cache.
    return undefined
  }
  ATTEMPT_COUNTER = 0

  const stopTimerDB = deps.telemetry?.startTimer('getPendingPayment', {
    callName: 'getPendingPayment_DB'
  })
  const payments = await OutgoingPayment.query(trx)
    .limit(1)
    // Ensure the payment cannot be processed concurrently by multiple workers.
    .forUpdate()
    // Don't wait for a payment that is already being processed.
    .skipLocked()
    .timeout(2000)
    .whereIn('state', [OutgoingPaymentState.Sending])
    // Back off between retries.
    .andWhere((builder: Knex.QueryBuilder) => {
      builder
        .where('stateAttempts', 0)
        .orWhereRaw(
          '"updatedAt" + LEAST("stateAttempts", 6) * ? * interval \'1 seconds\' < ?',
          [RETRY_BACKOFF_SECONDS, now]
        )
    })
  if (payments[0]) {
    await deps.quoteService.setOn(payments[0])
    await deps.walletAddressService.setOn(payments[0])
  }

  stopTimerDB && stopTimerDB()
  return payments[0]
}

async function handlePaymentLifecycle(
  deps: ServiceDependencies,
  payment: OutgoingPayment
): Promise<void> {
  if (payment.state !== OutgoingPaymentState.Sending) {
    deps.logger.warn('unexpected payment in lifecycle')
    return
  }

  const stopTimer = deps.telemetry?.startTimer('handleSending', {
    callName: 'handleSending'
  })

  try {
    await lifecycle.handleSending(deps, payment)
    stopTimer && stopTimer()
  } catch (error) {
    await onLifecycleError(deps, payment, error as Error | PaymentError)
    stopTimer && stopTimer()
  }
}

async function onLifecycleError(
  deps: ServiceDependencies,
  payment: OutgoingPayment,
  err: Error | PaymentError
): Promise<void> {
  const error = typeof err === 'string' ? err : err.message
  const stateAttempts = payment.stateAttempts + 1

  if (stateAttempts < MAX_STATE_ATTEMPTS && isRetryableError(err)) {
    deps.logger.warn(
      { state: payment.state, error, stateAttempts },
      'payment lifecycle failed; retrying'
    )
    await payment.$query(deps.knex).patch({ stateAttempts })
  } else {
    // Too many attempts or non-retryable error; fail payment.
    deps.logger.warn(
      { state: payment.state, error, stateAttempts },
      'payment lifecycle failed'
    )
    await lifecycle.handleFailed(deps, payment, error)
  }
  await deps.cacheDataStore.delete(payment.id)
}

function isRetryableError(error: Error | PaymentError): boolean {
  if (error instanceof PaymentMethodHandlerError) {
    return !!error.retryable
  }

  if (error instanceof Error) {
    return true
  }

  if (error === LifecycleError.RatesUnavailable) {
    return true
  }

  return false
}
