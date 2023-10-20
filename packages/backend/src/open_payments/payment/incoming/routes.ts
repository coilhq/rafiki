import Koa from 'koa'
import { Logger } from 'pino'
import {
  ReadContext,
  CreateContext,
  CompleteContext,
  ListContext,
  AuthenticatedStatusContext
} from '../../../app'
import { IAppConfig } from '../../../config/app'
import { IncomingPaymentService } from './service'
import { IncomingPayment } from './model'
import {
  errorToCode,
  errorToMessage,
  IncomingPaymentError,
  isIncomingPaymentError
} from './errors'
import { AmountJSON, parseAmount } from '../../amount'
import { listSubresource } from '../../wallet_address/routes'
import { Connection } from '../../connection/model'
import { ConnectionService } from '../../connection/service'
import {
  AccessAction,
  IncomingPayment as OpenPaymentsIncomingPayment,
  IncomingPaymentWithConnection as OpenPaymentsIncomingPaymentWithConnection,
  IncomingPaymentWithConnectionUrl as OpenPaymentsIncomingPaymentWithConnectionUrl
} from '@interledger/open-payments'
import { WalletAddress } from '../../wallet_address/model'

interface ServiceDependencies {
  config: IAppConfig
  logger: Logger
  incomingPaymentService: IncomingPaymentService
  connectionService: ConnectionService
}

export type ReadContextWithAuthenticatedStatus = ReadContext &
  AuthenticatedStatusContext

export interface IncomingPaymentRoutes {
  get(ctx: ReadContextWithAuthenticatedStatus): Promise<void>
  create(ctx: CreateContext<CreateBody>): Promise<void>
  complete(ctx: CompleteContext): Promise<void>
  list(ctx: ListContext): Promise<void>
}

export function createIncomingPaymentRoutes(
  deps_: ServiceDependencies
): IncomingPaymentRoutes {
  const logger = deps_.logger.child({
    service: 'IncomingPaymentRoutes'
  })
  const deps = { ...deps_, logger }
  return {
    get: (ctx: ReadContextWithAuthenticatedStatus) =>
      getIncomingPayment(deps, ctx),
    create: (ctx: CreateContext<CreateBody>) =>
      createIncomingPayment(deps, ctx),
    complete: (ctx: CompleteContext) => completeIncomingPayment(deps, ctx),
    list: (ctx: ListContext) => listIncomingPayments(deps, ctx)
  }
}

async function getIncomingPayment(
  deps: ServiceDependencies,
  ctx: ReadContextWithAuthenticatedStatus
) {
  if (ctx.authenticated) {
    await getIncomingPaymentPrivate(deps, ctx)
  } else {
    await getIncomingPaymentPublic(deps, ctx)
  }
}

async function getIncomingPaymentPublic(
  deps: ServiceDependencies,
  ctx: ReadContextWithAuthenticatedStatus
) {
  try {
    const incomingPayment = await deps.incomingPaymentService.get({
      id: ctx.params.id,
      client: ctx.accessAction === AccessAction.Read ? ctx.client : undefined,
      walletAddressId: ctx.walletAddress.id
    })
    ctx.body = incomingPayment?.toPublicOpenPaymentsType()
  } catch (err) {
    const msg = 'Error trying to get incoming payment'
    deps.logger.error({ err }, msg)
    ctx.throw(500, msg)
  }
}

async function getIncomingPaymentPrivate(
  deps: ServiceDependencies,
  ctx: ReadContextWithAuthenticatedStatus
): Promise<void> {
  let incomingPayment: IncomingPayment | undefined
  try {
    incomingPayment = await deps.incomingPaymentService.get({
      id: ctx.params.id,
      client: ctx.accessAction === AccessAction.Read ? ctx.client : undefined,
      walletAddressId: ctx.walletAddress.id
    })
  } catch (err) {
    ctx.throw(500, 'Error trying to get incoming payment')
  }
  if (!incomingPayment || !incomingPayment.walletAddress) return ctx.throw(404)
  const connection = deps.connectionService.get(incomingPayment)
  ctx.body = incomingPaymentToBody(
    incomingPayment.walletAddress,
    incomingPayment,
    connection
  )
}

export type CreateBody = {
  walletAddress: string
  expiresAt?: string
  incomingAmount?: AmountJSON
  metadata?: Record<string, unknown>
}

async function createIncomingPayment(
  deps: ServiceDependencies,
  ctx: CreateContext<CreateBody>
): Promise<void> {
  const { body } = ctx.request

  let expiresAt: Date | undefined
  if (body.expiresAt !== undefined) {
    expiresAt = new Date(body.expiresAt)
  }

  const incomingPaymentOrError = await deps.incomingPaymentService.create({
    walletAddressId: ctx.walletAddress.id,
    client: ctx.client,
    metadata: body.metadata,
    expiresAt,
    incomingAmount: body.incomingAmount && parseAmount(body.incomingAmount)
  })

  if (isIncomingPaymentError(incomingPaymentOrError)) {
    return ctx.throw(
      errorToCode[incomingPaymentOrError],
      errorToMessage[incomingPaymentOrError]
    )
  }

  if (!incomingPaymentOrError.walletAddress) {
    ctx.throw(404)
  }

  ctx.status = 201
  const connection = deps.connectionService.get(incomingPaymentOrError)
  ctx.body = incomingPaymentToBody(
    incomingPaymentOrError.walletAddress,
    incomingPaymentOrError,
    connection
  )
}

async function completeIncomingPayment(
  deps: ServiceDependencies,
  ctx: CompleteContext
): Promise<void> {
  let incomingPaymentOrError: IncomingPayment | IncomingPaymentError
  try {
    incomingPaymentOrError = await deps.incomingPaymentService.complete(
      ctx.params.id
    )
  } catch (err) {
    ctx.throw(500, 'Error trying to complete incoming payment')
  }

  if (isIncomingPaymentError(incomingPaymentOrError)) {
    return ctx.throw(
      errorToCode[incomingPaymentOrError],
      errorToMessage[incomingPaymentOrError]
    )
  }

  if (!incomingPaymentOrError.walletAddress) {
    ctx.throw(404)
  }

  ctx.body = incomingPaymentToBody(incomingPaymentOrError.walletAddress, incomingPaymentOrError)
}

async function listIncomingPayments(
  deps: ServiceDependencies,
  ctx: ListContext
): Promise<void> {
  try {
    await listSubresource({
      ctx,
      getWalletAddressPage: deps.incomingPaymentService.getWalletAddressPage,
      toBody: (payment) =>
        incomingPaymentToBody(
          ctx.walletAddress,
          payment,
          deps.connectionService.getUrl(payment)
        )
    })
  } catch (err) {
    if (err instanceof Koa.HttpError) {
      throw err
    }
    ctx.throw(500, 'Error trying to list incoming payments')
  }
}
function incomingPaymentToBody(
  walletAddress: WalletAddress,
  incomingPayment: IncomingPayment,
  ilpStreamConnection?: Connection | string
):
  | OpenPaymentsIncomingPayment
  | OpenPaymentsIncomingPaymentWithConnection
  | OpenPaymentsIncomingPaymentWithConnectionUrl {
  return incomingPayment.toOpenPaymentsType(walletAddress, ilpStreamConnection)
}
