import { Logger } from 'pino'
import { ReadContext, CreateContext, ListContext } from '../../../app'
import { IAppConfig } from '../../../config/app'
import {
  CreateOutgoingPaymentOptions,
  OutgoingPaymentService,
  BaseOptions as OutgoingPaymentCreateBaseOptions
} from './service'
import {
  isOutgoingPaymentError,
  errorToHTTPCode,
  errorToMessage
} from './errors'
import { OutgoingPayment } from './model'
import { listSubresource } from '../../wallet_address/routes'
import {
  AccessAction,
  OutgoingPayment as OpenPaymentsOutgoingPayment
} from '@interledger/open-payments'
import { WalletAddress } from '../../wallet_address/model'
import { OpenPaymentsServerRouteError } from '../../route-errors'
import { Amount } from '../../amount'

interface ServiceDependencies {
  config: IAppConfig
  logger: Logger
  outgoingPaymentService: OutgoingPaymentService
}

export interface OutgoingPaymentRoutes {
  get(ctx: ReadContext): Promise<void>
  create(ctx: CreateContext<CreateBody>): Promise<void>
  list(ctx: ListContext): Promise<void>
}

export function createOutgoingPaymentRoutes(
  deps_: ServiceDependencies
): OutgoingPaymentRoutes {
  const logger = deps_.logger.child({
    service: 'OutgoingPaymentRoutes'
  })
  const deps = { ...deps_, logger }
  return {
    get: (ctx: ReadContext) => getOutgoingPayment(deps, ctx),
    create: (ctx: CreateContext<CreateBody>) =>
      createOutgoingPayment(deps, ctx),
    list: (ctx: ListContext) => listOutgoingPayments(deps, ctx)
  }
}

async function getOutgoingPayment(
  deps: ServiceDependencies,
  ctx: ReadContext
): Promise<void> {
  const outgoingPayment = await deps.outgoingPaymentService.get({
    id: ctx.params.id,
    tenantId: ctx.params.tenantId,
    client: ctx.accessAction === AccessAction.Read ? ctx.client : undefined
  })

  if (!outgoingPayment) {
    throw new OpenPaymentsServerRouteError(
      404,
      'Outgoing payment does not exist',
      {
        id: ctx.params.id
      }
    )
  }

  ctx.body = outgoingPaymentToBody(ctx.walletAddress, outgoingPayment)
}

type CreateBodyBase = {
  walletAddress: string
  metadata?: Record<string, unknown>
}

type CreateBodyFromQuote = CreateBodyBase & {
  quoteId: string
}

type CreateBodyFromIncomingPayment = CreateBodyBase & {
  incomingPayment: string
  debitAmount: Amount
}

function isCreateFromIncomingPayment(
  body: CreateBody
): body is CreateBodyFromIncomingPayment {
  return 'incomingPayment' in body && 'debitAmount' in body
}

export type CreateBody = CreateBodyFromQuote | CreateBodyFromIncomingPayment

async function createOutgoingPayment(
  deps: ServiceDependencies,
  ctx: CreateContext<CreateBody>
): Promise<void> {
  const { body } = ctx.request
  const baseOptions: OutgoingPaymentCreateBaseOptions = {
    tenantId: ctx.params.tenantId,
    walletAddressId: ctx.walletAddress.id,
    metadata: body.metadata,
    client: ctx.client,
    grant: ctx.grant
  }
  let options: CreateOutgoingPaymentOptions

  if (isCreateFromIncomingPayment(body)) {
    options = {
      ...baseOptions,
      incomingPayment: body.incomingPayment,
      debitAmount: body.debitAmount
    }
  } else {
    const quoteUrlParts = body.quoteId.split('/')
    const quoteId = quoteUrlParts.pop() || quoteUrlParts.pop() // handle trailing slash
    if (!quoteId) {
      throw new OpenPaymentsServerRouteError(
        400,
        'Invalid quote id trying to create outgoing payment'
      )
    }
    options = {
      ...baseOptions,
      quoteId
    }
  }

  const outgoingPaymentOrError =
    await deps.outgoingPaymentService.create(options)

  if (isOutgoingPaymentError(outgoingPaymentOrError)) {
    throw new OpenPaymentsServerRouteError(
      errorToHTTPCode[outgoingPaymentOrError],
      errorToMessage[outgoingPaymentOrError]
    )
  }

  ctx.status = 201
  ctx.body = outgoingPaymentOrError.toOpenPaymentsWithSpentAmountsType(
    ctx.walletAddress
  )
}

async function listOutgoingPayments(
  deps: ServiceDependencies,
  ctx: ListContext
): Promise<void> {
  await listSubresource({
    ctx,
    getWalletAddressPage: async ({ walletAddressId, pagination, client }) =>
      deps.outgoingPaymentService.getWalletAddressPage({
        walletAddressId,
        pagination,
        client,
        tenantId: ctx.params.tenantId
      }),
    toBody: (payment) => outgoingPaymentToBody(ctx.walletAddress, payment)
  })
}

function outgoingPaymentToBody(
  walletAddress: WalletAddress,
  outgoingPayment: OutgoingPayment
): OpenPaymentsOutgoingPayment {
  return outgoingPayment.toOpenPaymentsType(walletAddress)
}
