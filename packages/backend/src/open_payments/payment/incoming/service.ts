import {
  IncomingPayment,
  IncomingPaymentEvent,
  IncomingPaymentEventType,
  IncomingPaymentState
} from './model'
import { AccountingService } from '../../../accounting/service'
import { BaseService } from '../../../shared/baseService'
import { Knex } from 'knex'
import { TransactionOrKnex } from 'objection'
import { GetOptions, ListOptions } from '../../wallet_address/model'
import {
  WalletAddressService,
  WalletAddressSubresourceService
} from '../../wallet_address/service'

import { Amount } from '../../amount'
import { IncomingPaymentError } from './errors'
import { IAppConfig } from '../../../config/app'
import { poll } from '../../../shared/utils'
import { AssetService } from '../../../asset/service'

export const POSITIVE_SLIPPAGE = BigInt(1)
// First retry waits 10 seconds
// Second retry waits 20 (more) seconds
// Third retry waits 30 (more) seconds, etc. up to 60 seconds
export const RETRY_BACKOFF_MS = 10_000

export interface CreateIncomingPaymentOptions {
  walletAddressId: string
  client?: string
  expiresAt?: Date
  incomingAmount?: Amount
  metadata?: Record<string, unknown>
  tenantId: string
}

export interface UpdateOptions {
  id: string
  metadata: Record<string, unknown>
  tenantId: string
}

export interface IncomingPaymentService
  extends WalletAddressSubresourceService<IncomingPayment> {
  create(
    options: CreateIncomingPaymentOptions,
    trx?: Knex.Transaction
  ): Promise<IncomingPayment | IncomingPaymentError>
  approve(
    id: string,
    tenantId: string
  ): Promise<IncomingPayment | IncomingPaymentError>
  cancel(
    id: string,
    tenantId: string
  ): Promise<IncomingPayment | IncomingPaymentError>
  complete(
    id: string,
    tenantId: string
  ): Promise<IncomingPayment | IncomingPaymentError>
  processNext(): Promise<string | undefined>
  update(
    options: UpdateOptions
  ): Promise<IncomingPayment | IncomingPaymentError>
}

export interface ServiceDependencies extends BaseService {
  knex: TransactionOrKnex
  accountingService: AccountingService
  walletAddressService: WalletAddressService
  assetService: AssetService
  config: IAppConfig
}

export async function createIncomingPaymentService(
  deps_: ServiceDependencies
): Promise<IncomingPaymentService> {
  const log = deps_.logger.child({
    service: 'IncomingPaymentService'
  })
  const deps: ServiceDependencies = {
    ...deps_,
    logger: log
  }
  return {
    get: (options) => getIncomingPayment(deps, options),
    create: (options, trx) => createIncomingPayment(deps, options, trx),
    approve: (id, tenantId) => approveIncomingPayment(deps, id, tenantId),
    cancel: (id, tenantId) => cancelIncomingPayment(deps, id, tenantId),
    complete: (id, tenantId) => completeIncomingPayment(deps, id, tenantId),
    getWalletAddressPage: (options) => getWalletAddressPage(deps, options),
    processNext: () => processNextIncomingPayment(deps),
    update: (options) => updateIncomingPayment(deps, options)
  }
}

async function getIncomingPayment(
  deps: ServiceDependencies,
  options: GetOptions
): Promise<IncomingPayment | undefined> {
  const incomingPayment = await IncomingPayment.query(deps.knex).get(options)
  if (incomingPayment) {
    const asset = await deps.assetService.get(incomingPayment.assetId)
    if (asset) incomingPayment.asset = asset

    incomingPayment.walletAddress = await deps.walletAddressService.get(
      incomingPayment.walletAddressId
    )

    return await addReceivedAmount(deps, incomingPayment)
  } else return
}

async function updateIncomingPayment(
  deps: ServiceDependencies,
  options: UpdateOptions
): Promise<IncomingPayment | IncomingPaymentError> {
  const incomingPayment = await IncomingPayment.query(
    deps.knex
  ).patchAndFetchById(options.id, options)
  if (incomingPayment) {
    const asset = await deps.assetService.get(incomingPayment.assetId)
    if (asset) incomingPayment.asset = asset

    incomingPayment.walletAddress = await deps.walletAddressService.get(
      incomingPayment.walletAddressId
    )
  }

  return incomingPayment
    ? await addReceivedAmount(deps, incomingPayment)
    : IncomingPaymentError.UnknownPayment
}

async function createIncomingPayment(
  deps: ServiceDependencies,
  {
    walletAddressId,
    client,
    expiresAt,
    incomingAmount,
    metadata,
    tenantId
  }: CreateIncomingPaymentOptions,
  trx?: Knex.Transaction
): Promise<IncomingPayment | IncomingPaymentError> {
  if (!expiresAt) {
    expiresAt = new Date(Date.now() + deps.config.incomingPaymentExpiryMaxMs)
  } else if (
    expiresAt.getTime() <= Date.now() ||
    expiresAt.getTime() > Date.now() + deps.config.incomingPaymentExpiryMaxMs
  ) {
    return IncomingPaymentError.InvalidExpiry
  }
  if (incomingAmount && incomingAmount.value <= 0) {
    return IncomingPaymentError.InvalidAmount
  }
  const walletAddress = await deps.walletAddressService.get(
    walletAddressId,
    tenantId
  )
  if (!walletAddress) {
    return IncomingPaymentError.UnknownWalletAddress
  }
  if (!walletAddress.isActive) {
    return IncomingPaymentError.InactiveWalletAddress
  }
  if (incomingAmount) {
    if (
      incomingAmount.assetCode !== walletAddress.asset.code ||
      incomingAmount.assetScale !== walletAddress.asset.scale
    ) {
      return IncomingPaymentError.InvalidAmount
    }
  }

  let incomingPayment = await IncomingPayment.query(
    trx || deps.knex
  ).insertAndFetch({
    walletAddressId: walletAddressId,
    client,
    assetId: walletAddress.asset.id,
    expiresAt,
    incomingAmount,
    metadata,
    state: IncomingPaymentState.Pending,
    processAt: expiresAt,
    tenantId
  })

  const asset = await deps.assetService.get(incomingPayment.assetId)
  if (asset) incomingPayment.asset = asset

  incomingPayment.walletAddress = await deps.walletAddressService.get(
    incomingPayment.walletAddressId
  )

  await IncomingPaymentEvent.query(trx || deps.knex).insert({
    incomingPaymentId: incomingPayment.id,
    type: IncomingPaymentEventType.IncomingPaymentCreated,
    data: incomingPayment.toData(0n)
  })

  incomingPayment = await addReceivedAmount(deps, incomingPayment, BigInt(0))
  if (!deps.config.pollIncomingPaymentCreatedWebhook) {
    return incomingPayment
  }

  try {
    const response = await poll({
      request: async () =>
        getApprovedOrCanceledIncomingPayment(deps, { id: incomingPayment.id }),
      pollingFrequencyMs: deps.config.incomingPaymentCreatedPollFrequency,
      timeoutMs: deps.config.incomingPaymentCreatedPollTimeout
    })

    if (response?.cancelledAt) {
      deps.logger.info(
        {
          cancelledAt: response.cancelledAt.toISOString(),
          paymentId: incomingPayment.id
        },
        'Incoming payment was cancelled'
      )
      return IncomingPaymentError.ActionNotPerformed
    }

    if (response?.approvedAt) return response
    deps.logger.error(
      { response },
      'Got response, but incoming payment is not approved or cancelled'
    )
    return IncomingPaymentError.ActionNotPerformed
  } catch (err) {
    const errorMessage = 'Got error / timeout while polling incoming payment'
    deps.logger.error(
      { errorMessage: err instanceof Error && err.message },
      errorMessage
    )
    return IncomingPaymentError.ActionNotPerformed
  }
}

async function getApprovedOrCanceledIncomingPayment(
  deps: ServiceDependencies,
  options: GetOptions
) {
  const incomingPayment = await IncomingPayment.query(deps.knex)
    .get(options)
    .whereNotNull('approvedAt')
    .orWhereNotNull('cancelledAt')
  if (incomingPayment) {
    const asset = await deps.assetService.get(incomingPayment.assetId)
    if (asset) incomingPayment.asset = asset

    incomingPayment.walletAddress = await deps.walletAddressService.get(
      incomingPayment.walletAddressId
    )
  }
  return incomingPayment
}

// Fetch (and lock) an incoming payment for work.
// Returns the id of the processed incoming payment (if any).
async function processNextIncomingPayment(
  deps_: ServiceDependencies
): Promise<string | undefined> {
  return deps_.knex.transaction(async (trx) => {
    const now = new Date(Date.now()).toISOString()
    const incomingPayments = await IncomingPayment.query(trx)
      .limit(1)
      // Ensure the incoming payments cannot be processed concurrently by multiple workers.
      .forUpdate()
      // If an incoming payment is locked, don't wait — just come back for it later.
      .skipLocked()
      .where('processAt', '<=', now)

    const incomingPayment = incomingPayments[0]
    if (!incomingPayment) return

    const asset = await deps_.assetService.get(incomingPayment.assetId)
    if (asset) incomingPayment.asset = asset

    incomingPayment.walletAddress = await deps_.walletAddressService.get(
      incomingPayment.walletAddressId
    )

    const deps = {
      ...deps_,
      knex: trx,
      logger: deps_.logger.child({
        incomingPayment: incomingPayment.id
      })
    }
    if (
      incomingPayment.state === IncomingPaymentState.Expired ||
      incomingPayment.state === IncomingPaymentState.Completed
    ) {
      await handleDeactivated(deps, incomingPayment)
    } else {
      await handleExpired(deps, incomingPayment)
    }
    return incomingPayment.id
  })
}

// Deactivate expired incoming payments that have some money.
// Delete expired incoming payments that have never received money.
async function handleExpired(
  deps: ServiceDependencies,
  incomingPayment: IncomingPayment
): Promise<void> {
  const amountReceived = await deps.accountingService.getTotalReceived(
    incomingPayment.id
  )
  if (amountReceived) {
    deps.logger.trace(
      { amountReceived },
      'deactivating expired incoming payment'
    )
    await incomingPayment.$query(deps.knex).patch({
      state: IncomingPaymentState.Expired,
      processAt: new Date()
    })
  } else {
    deps.logger.debug({ amountReceived }, 'deleting expired incoming payment')
    await incomingPayment.$query(deps.knex).delete()
  }
}

// Create webhook event to withdraw deactivated incoming payments' liquidity.
async function handleDeactivated(
  deps: ServiceDependencies,
  incomingPayment: IncomingPayment
): Promise<void> {
  if (!incomingPayment.processAt) {
    throw new Error('processAt field is not defined')
  }
  try {
    const amountReceived = await deps.accountingService.getTotalReceived(
      incomingPayment.id
    )
    if (!amountReceived) {
      deps.logger.warn(
        { amountReceived },
        'deactivated incoming payment and empty balance'
      )
      await incomingPayment.$query(deps.knex).patch({ processAt: null })
      return
    }

    const type =
      incomingPayment.state == IncomingPaymentState.Expired
        ? IncomingPaymentEventType.IncomingPaymentExpired
        : IncomingPaymentEventType.IncomingPaymentCompleted
    deps.logger.trace({ type }, 'creating incoming payment webhook event')

    await IncomingPaymentEvent.query(deps.knex).insert({
      incomingPaymentId: incomingPayment.id,
      type,
      data: incomingPayment.toData(amountReceived),
      withdrawal: {
        accountId: incomingPayment.id,
        assetId: incomingPayment.assetId,
        amount: amountReceived
      }
    })

    await incomingPayment.$query(deps.knex).patch({
      processAt: null
    })
  } catch (error) {
    deps.logger.warn({ error }, 'webhook event creation failed; retrying')
  }
}

async function getWalletAddressPage(
  deps: ServiceDependencies,
  options: ListOptions
): Promise<IncomingPayment[]> {
  const pageQuery = IncomingPayment.query(deps.knex)

  if (options.tenantId) pageQuery.where('tenantId', options.tenantId)

  const page = await pageQuery.list(options)

  for (const payment of page) {
    const asset = await deps.assetService.get(payment.assetId)
    if (asset) payment.asset = asset

    payment.walletAddress = await deps.walletAddressService.get(
      payment.walletAddressId
    )
  }

  const amounts = await deps.accountingService.getAccountsTotalReceived(
    page.map((payment: IncomingPayment) => payment.id)
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  return page.map((payment: IncomingPayment, i: number) => {
    try {
      payment.receivedAmount = {
        value: amounts[i] || BigInt(0),
        assetCode: payment.asset.code,
        assetScale: payment.asset.scale
      }
    } catch (_) {
      deps.logger.error(
        { payment: payment.id },
        'incoming payment account not found'
      )
      throw new Error(
        `Underlying TB account not found, incoming payment id: ${payment.id}`
      )
    }
    return payment
  })
}

async function approveIncomingPayment(
  deps: ServiceDependencies,
  id: string,
  tenantId: string
): Promise<IncomingPayment | IncomingPaymentError> {
  return deps.knex.transaction(async (trx) => {
    const payment = await IncomingPayment.query(trx)
      .get({ id, tenantId })
      .forUpdate()

    if (!payment) return IncomingPaymentError.UnknownPayment

    const asset = await deps.assetService.get(payment.assetId)
    if (asset) payment.asset = asset

    payment.walletAddress = await deps.walletAddressService.get(
      payment.walletAddressId
    )

    if (payment.state !== IncomingPaymentState.Pending)
      return IncomingPaymentError.WrongState

    if (payment.cancelledAt) {
      deps.logger.info({
        errorMessage: 'Cannot approve already cancelled incoming payment',
        paymentId: payment.id
      })
      return IncomingPaymentError.AlreadyActioned
    }

    if (!payment.approvedAt) {
      await payment.$query(trx).patch({
        approvedAt: new Date(Date.now())
      })
    }

    return await addReceivedAmount(deps, payment)
  })
}

async function cancelIncomingPayment(
  deps: ServiceDependencies,
  id: string,
  tenantId: string
): Promise<IncomingPayment | IncomingPaymentError> {
  return deps.knex.transaction(async (trx) => {
    const payment = await IncomingPayment.query(trx)
      .get({ id, tenantId })
      .forUpdate()

    if (!payment) return IncomingPaymentError.UnknownPayment

    const asset = await deps.assetService.get(payment.assetId)
    if (asset) payment.asset = asset

    payment.walletAddress = await deps.walletAddressService.get(
      payment.walletAddressId
    )

    if (payment.state !== IncomingPaymentState.Pending)
      return IncomingPaymentError.WrongState

    if (payment.approvedAt) {
      deps.logger.info({
        errorMessage: 'Cannot cancel already approved incoming payment',
        paymentId: payment.id
      })
      return IncomingPaymentError.AlreadyActioned
    }

    if (!payment.cancelledAt) {
      await payment.$query(trx).patch({
        cancelledAt: new Date(Date.now())
      })
    }

    return await addReceivedAmount(deps, payment)
  })
}

async function completeIncomingPayment(
  deps: ServiceDependencies,
  id: string,
  tenantId: string
): Promise<IncomingPayment | IncomingPaymentError> {
  return deps.knex.transaction(async (trx) => {
    const payment = await IncomingPayment.query(trx)
      .get({ id, tenantId })
      .forUpdate()
    if (!payment) return IncomingPaymentError.UnknownPayment

    const asset = await deps.assetService.get(payment.assetId)
    if (asset) payment.asset = asset

    payment.walletAddress = await deps.walletAddressService.get(
      payment.walletAddressId
    )

    if (
      ![IncomingPaymentState.Pending, IncomingPaymentState.Processing].includes(
        payment.state
      )
    ) {
      return IncomingPaymentError.WrongState
    }
    await payment.$query(trx).patch({
      state: IncomingPaymentState.Completed,
      processAt: new Date()
    })
    return await addReceivedAmount(deps, payment)
  })
}

async function addReceivedAmount(
  deps: ServiceDependencies,
  payment: IncomingPayment,
  value?: bigint
): Promise<IncomingPayment> {
  const received =
    value ?? (await deps.accountingService.getTotalReceived(payment.id))

  payment.receivedAmount = {
    value: received || BigInt(0),
    assetCode: payment.asset.code,
    assetScale: payment.asset.scale
  }

  return payment
}
