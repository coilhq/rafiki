import { AccessAction } from '@interledger/open-payments'
import { Logger } from 'pino'
import { ReadContext, CreateContext } from '../../app'
import { IAppConfig } from '../../config/app'
import { CreateQuoteOptions, QuoteService } from './service'
import { isQuoteError, errorToHTTPCode, errorToMessage } from './errors'
import { Quote } from './model'
import { AmountJSON, parseAmount } from '../amount'
import { Quote as OpenPaymentsQuote } from '@interledger/open-payments'
import { WalletAddress } from '../wallet_address/model'
import { OpenPaymentsServerRouteError } from '../route-errors'

interface ServiceDependencies {
  config: IAppConfig
  logger: Logger
  quoteService: QuoteService
}

export interface QuoteRoutes {
  get(ctx: ReadContext): Promise<void>
  create(ctx: CreateContext<CreateBody>): Promise<void>
}

export function createQuoteRoutes(deps_: ServiceDependencies): QuoteRoutes {
  const logger = deps_.logger.child({
    service: 'QuoteRoutes'
  })
  const deps = { ...deps_, logger }
  return {
    get: (ctx: ReadContext) => getQuote(deps, ctx),
    create: (ctx: CreateContext<CreateBody>) => createQuote(deps, ctx)
  }
}

async function getQuote(
  deps: ServiceDependencies,
  ctx: ReadContext
): Promise<void> {
  const quote = await deps.quoteService.get({
    id: ctx.params.id,
    client: ctx.accessAction === AccessAction.Read ? ctx.client : undefined,
    tenantId: ctx.params.tenantId
  })

  if (!quote) {
    throw new OpenPaymentsServerRouteError(404, 'Quote does not exist', {
      id: ctx.params.id
    })
  }

  ctx.body = quoteToBody(ctx.walletAddress, quote)
}

interface CreateBodyBase {
  walletAddress: string
  receiver: string
  method: 'ilp'
}

interface CreateBodyWithDebitAmount extends CreateBodyBase {
  debitAmount?: AmountJSON
  receiveAmount?: never
}

interface CreateBodyWithReceiveAmount extends CreateBodyBase {
  debitAmount?: never
  receiveAmount?: AmountJSON
}

export type CreateBody = CreateBodyWithDebitAmount | CreateBodyWithReceiveAmount

async function createQuote(
  deps: ServiceDependencies,
  ctx: CreateContext<CreateBody>
): Promise<void> {
  const { body } = ctx.request
  const { tenantId } = ctx.params
  const options: CreateQuoteOptions = {
    tenantId,
    walletAddressId: ctx.walletAddress.id,
    receiver: body.receiver,
    client: ctx.client,
    method: body.method
  }

  try {
    if (body.debitAmount) options.debitAmount = parseAmount(body.debitAmount)
    if (body.receiveAmount)
      options.receiveAmount = parseAmount(body.receiveAmount)
  } catch (err) {
    throw new OpenPaymentsServerRouteError(
      400,
      'Could not parse amounts when creating quote',
      { requestBody: body }
    )
  }

  const quoteOrErr = await deps.quoteService.create(options)

  if (isQuoteError(quoteOrErr)) {
    throw new OpenPaymentsServerRouteError(
      errorToHTTPCode[quoteOrErr],
      errorToMessage[quoteOrErr]
    )
  }

  ctx.status = 201
  ctx.body = quoteToBody(ctx.walletAddress, quoteOrErr)
}

function quoteToBody(
  walletAddress: WalletAddress,
  quote: Quote
): OpenPaymentsQuote {
  return quote.toOpenPaymentsType(walletAddress)
}
