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

// Returns the id of the processed payment (if any).
export async function processPendingPayment(
  deps_: ServiceDependencies
): Promise<string | undefined> {
  const tracer = trace.getTracer('outgoing_payment_worker')

  return tracer.startActiveSpan(
    'outgoingPaymentLifecycle',
    async (span: Span) => {
      const paymentId = await deps_.knex.transaction(async (trx) => {
        const payment = await getPendingPayment(trx)
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

      span.end()
      return paymentId
    }
  )
}

// Fetch (and lock) a payment for work.
async function getPendingPayment(
  trx: Knex.Transaction
): Promise<OutgoingPayment | undefined> {
  const now = new Date(Date.now()).toISOString()
  const payments = await OutgoingPayment.query(trx)
    .limit(1)
    // Ensure the payment cannot be processed concurrently by multiple workers.
    .forUpdate()
    // Don't wait for a payment that is already being processed.
    .skipLocked()
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
    .withGraphFetched('[walletAddress, quote.asset]')
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

  try {
    await lifecycle.handleSending(deps, payment)
  } catch (error) {
    await onLifecycleError(deps, payment, error as Error | PaymentError)
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
