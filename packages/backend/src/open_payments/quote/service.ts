import { TransactionOrKnex } from 'objection'

import { BaseService } from '../../shared/baseService'
import { QuoteError, isQuoteError } from './errors'
import { Quote } from './model'
import { Amount } from '../amount'
import { ReceiverService } from '../receiver/service'
import { Receiver } from '../receiver/model'
import { GetOptions, ListOptions } from '../wallet_address/model'
import {
  WalletAddressService,
  WalletAddressSubresourceService
} from '../wallet_address/service'
import { PaymentMethodHandlerService } from '../../payment-method/handler/service'
import { IAppConfig } from '../../config/app'
import { FeeService } from '../../fee/service'
import { FeeType } from '../../fee/model'
import {
  PaymentMethodHandlerError,
  PaymentMethodHandlerErrorCode
} from '../../payment-method/handler/errors'
import { v4 as uuid } from 'uuid'
import { TelemetryService } from '../../telemetry/service'
import { AssetService } from '../../asset/service'

export interface QuoteService extends WalletAddressSubresourceService<Quote> {
  create(options: CreateQuoteOptions): Promise<Quote | QuoteError>
}

export interface ServiceDependencies extends BaseService {
  config: IAppConfig
  knex: TransactionOrKnex
  receiverService: ReceiverService
  walletAddressService: WalletAddressService
  assetService: AssetService
  feeService: FeeService
  paymentMethodHandlerService: PaymentMethodHandlerService
  telemetry: TelemetryService
}

export async function createQuoteService(
  deps_: ServiceDependencies
): Promise<QuoteService> {
  const deps = {
    ...deps_,
    logger: deps_.logger.child({ service: 'QuoteService' })
  }
  return {
    get: (options) => getQuote(deps, options),
    create: (options: CreateQuoteOptions) => createQuote(deps, options),
    getWalletAddressPage: (options) => getWalletAddressPage(deps, options)
  }
}

async function getQuote(
  deps: ServiceDependencies,
  options: GetOptions
): Promise<Quote | undefined> {
  const quote = await Quote.query(deps.knex)
    .get(options)
    .withGraphFetched('fee')
  if (quote) {
    const asset = await deps.assetService.get(quote.assetId)
    if (asset) quote.asset = asset

    quote.walletAddress = await deps.walletAddressService.get(
      quote.walletAddressId
    )
  }
  return quote
}

interface QuoteOptionsBase {
  tenantId: string
  walletAddressId: string
  receiver: string
  method: 'ilp'
  client?: string
}

interface QuoteOptionsWithDebitAmount extends QuoteOptionsBase {
  receiveAmount?: never
  debitAmount?: Amount
}

interface QuoteOptionsWithReceiveAmount extends QuoteOptionsBase {
  receiveAmount?: Amount
  debitAmount?: never
}

export type CreateQuoteOptions =
  | QuoteOptionsWithDebitAmount
  | QuoteOptionsWithReceiveAmount

async function createQuote(
  deps: ServiceDependencies,
  options: CreateQuoteOptions
): Promise<Quote | QuoteError> {
  const stopTimer = deps.telemetry.startTimer('quote_service_create_time_ms', {
    callName: 'QuoteService:create',
    description: 'Time to create a quote'
  })
  if (options.debitAmount && options.receiveAmount) {
    stopTimer()
    return QuoteError.InvalidAmount
  }
  const walletAddress = await deps.walletAddressService.get(
    options.walletAddressId,
    options.tenantId
  )
  if (!walletAddress) {
    stopTimer()
    return QuoteError.UnknownWalletAddress
  }
  if (!walletAddress.isActive) {
    stopTimer()
    return QuoteError.InactiveWalletAddress
  }
  if (options.debitAmount) {
    if (
      options.debitAmount.value <= BigInt(0) ||
      options.debitAmount.assetCode !== walletAddress.asset.code ||
      options.debitAmount.assetScale !== walletAddress.asset.scale
    ) {
      stopTimer()
      return QuoteError.InvalidAmount
    }
  }
  if (options.receiveAmount) {
    if (options.receiveAmount.value <= BigInt(0)) {
      stopTimer()
      return QuoteError.InvalidAmount
    }
  }

  try {
    const stopTimerReceiver = deps.telemetry.startTimer(
      'quote_service_create_resolve_receiver_time_ms',
      {
        callName: 'QuoteService:resolveReceiver',
        description: 'Time to resolve receiver'
      }
    )
    const receiver = await resolveReceiver(deps, options)
    stopTimerReceiver()

    const paymentMethod = receiver.isLocal ? 'LOCAL' : 'ILP'
    const quoteId = uuid()

    return await Quote.transaction(deps.knex, async (trx) => {
      const stopQuoteCreate = deps.telemetry.startTimer(
        'quote_service_create_insert_time_ms',
        {
          callName: 'QuoteModel.insert',
          description: 'Time to insert quote'
        }
      )
      const stopTimerQuote = deps.telemetry.startTimer(
        'quote_service_create_get_quote_time_ms',
        {
          callName: 'PaymentMethodHandlerService:getQuote',
          description: 'Time to getQuote'
        }
      )
      const quote = await deps.paymentMethodHandlerService.getQuote(
        paymentMethod,
        {
          quoteId,
          walletAddress,
          receiver,
          receiveAmount: options.receiveAmount,
          debitAmount: options.debitAmount
        },
        trx
      )
      stopTimerQuote()

      const stopTimerFee = deps.telemetry.startTimer(
        'quote_service_create_get_latest_fee_time_ms',
        {
          callName: 'FeeService:getLatestFee',
          description: 'Time to getLatestFee'
        }
      )
      const sendingFee = await deps.feeService.getLatestFee(
        walletAddress.assetId,
        FeeType.Sending
      )
      stopTimerFee()

      const createdQuote = await Quote.query(trx)
        .insertAndFetch({
          id: quoteId,
          tenantId: options.tenantId,
          walletAddressId: options.walletAddressId,
          assetId: walletAddress.assetId,
          receiver: options.receiver,
          debitAmount: quote.debitAmount,
          receiveAmount: quote.receiveAmount,
          expiresAt: new Date(0), // expiresAt is patched in finalizeQuote
          client: options.client,
          feeId: sendingFee?.id,
          estimatedExchangeRate: quote.estimatedExchangeRate
        })
        .withGraphFetched('fee')
      const asset = await deps.assetService.get(createdQuote.assetId)
      if (asset) createdQuote.asset = asset

      createdQuote.walletAddress = await deps.walletAddressService.get(
        createdQuote.walletAddressId
      )

      stopQuoteCreate()

      const stopFinalize = deps.telemetry.startTimer(
        'quote_service_finalize_quote_ms',
        {
          callName: 'QuoteService:finalizedQuote',
          description: 'Time to finalize quote'
        }
      )
      const finalizedQuote = await finalizeQuote(
        {
          ...deps,
          knex: trx
        },
        options,
        createdQuote,
        receiver
      )
      stopFinalize()
      return finalizedQuote
    })
  } catch (err) {
    if (isQuoteError(err)) {
      return err
    }

    if (
      err instanceof PaymentMethodHandlerError &&
      err.code === PaymentMethodHandlerErrorCode.QuoteNonPositiveReceiveAmount
    ) {
      return QuoteError.NonPositiveReceiveAmount
    }

    deps.logger.error({ err }, 'error creating a quote')
    throw err
  } finally {
    stopTimer()
  }
}

export async function resolveReceiver(
  deps: ServiceDependencies,
  options: CreateQuoteOptions
): Promise<Receiver> {
  const receiver = await deps.receiverService.get(options.receiver)
  if (!receiver) {
    deps.logger.info(
      { receiver: options.receiver },
      'Could not create quote. Receiver not found'
    )
    throw QuoteError.InvalidReceiver
  }
  if (options.receiveAmount) {
    if (
      options.receiveAmount.assetScale !== receiver.assetScale ||
      options.receiveAmount.assetCode !== receiver.assetCode
    ) {
      throw QuoteError.InvalidAmount
    }
    if (receiver.incomingAmount && receiver.receivedAmount) {
      const receivingPaymentValue =
        receiver.incomingAmount.value - receiver.receivedAmount.value
      if (receivingPaymentValue < options.receiveAmount.value) {
        throw QuoteError.InvalidAmount
      }
    }
  } else if (!options.debitAmount && !receiver.incomingAmount) {
    deps.logger.info(
      {
        debitAmount: options.debitAmount,
        incomingAmount: receiver.incomingAmount
      },
      'Could not create quote. debitAmount or incomingAmount required.'
    )
    throw QuoteError.InvalidReceiver
  }
  return receiver
}

interface CalculateQuoteAmountsWithFeesResult {
  receiveAmountValue: bigint
  debitAmountValue: bigint
  debitAmountMinusFees: bigint
}

/**
 * Calculate fixed-send quote amounts: debitAmount is locked,
 * subtract fees (considering the exchange rate) from the receiveAmount.
 */
function calculateFixedSendQuoteAmounts(
  deps: ServiceDependencies,
  quote: Quote,
  maxReceiveAmountValue: bigint
): CalculateQuoteAmountsWithFeesResult {
  // TODO: derive fee from debitAmount instead? Current behavior/tests may be wrong with basis point fees.
  const fees = quote.fee?.calculate(quote.receiveAmount.value) ?? BigInt(0)

  const { estimatedExchangeRate } = quote

  const exchangeAdjustedFees = BigInt(
    Math.ceil(Number(fees) * estimatedExchangeRate)
  )
  const receiveAmountValue =
    BigInt(quote.receiveAmount.value) - exchangeAdjustedFees

  if (receiveAmountValue <= BigInt(0)) {
    deps.logger.info(
      { fees, exchangeAdjustedFees, estimatedExchangeRate, receiveAmountValue },
      'Negative receive amount when calculating quote amount'
    )
    throw QuoteError.NonPositiveReceiveAmount
  }

  if (receiveAmountValue > maxReceiveAmountValue) {
    throw QuoteError.InvalidAmount
  }

  const debitAmountMinusFees =
    quote.debitAmount.value -
    (quote.fee?.calculate(quote.debitAmount.value) ?? 0n)

  deps.logger.debug(
    {
      'quote.receiveAmount.value': quote.receiveAmount.value,
      debitAmountValue: quote.debitAmount.value,
      debitAmountMinusFees,
      receiveAmountValue,
      fees,
      exchangeAdjustedFees
    },
    'Calculated fixed-send quote amount with fees'
  )

  return {
    debitAmountValue: quote.debitAmount.value,
    debitAmountMinusFees,
    receiveAmountValue
  }
}

/**
 * Calculate fixed-delivery quote amounts: receiveAmount is locked,
 * add fees to the the debitAmount.
 */
function calculateFixedDeliveryQuoteAmounts(
  deps: ServiceDependencies,
  quote: Quote
): CalculateQuoteAmountsWithFeesResult {
  const fees = quote.fee?.calculate(quote.debitAmount.value) ?? BigInt(0)

  const debitAmountValue = BigInt(quote.debitAmount.value) + fees

  if (debitAmountValue <= BigInt(0)) {
    deps.logger.info(
      { fees, debitAmountValue },
      'Received negative debitAmount receive amount when calculating quote amount'
    )
    throw QuoteError.InvalidAmount
  }

  deps.logger.debug(
    { debitAmountValue, receiveAmountValue: quote.receiveAmount.value, fees },
    `Calculated fixed-delivery quote amount with fees`
  )

  return {
    debitAmountValue,
    debitAmountMinusFees: quote.debitAmount.value,
    receiveAmountValue: quote.receiveAmount.value
  }
}

function calculateExpiry(
  deps: ServiceDependencies,
  quote: Quote,
  receiver: Receiver
): Date {
  const quoteExpiry = new Date(
    quote.createdAt.getTime() + deps.config.quoteLifespan
  )

  const incomingPaymentExpiresEarlier =
    receiver.incomingPayment?.expiresAt &&
    receiver.incomingPayment.expiresAt.getTime() < quoteExpiry.getTime()

  return incomingPaymentExpiresEarlier
    ? receiver.incomingPayment!.expiresAt!
    : quoteExpiry
}

async function finalizeQuote(
  deps: ServiceDependencies,
  options: CreateQuoteOptions,
  quote: Quote,
  receiver: Receiver
): Promise<Quote> {
  let maxReceiveAmountValue: bigint | undefined

  if (options.debitAmount) {
    const receivingPaymentValue =
      receiver.incomingAmount && receiver.receivedAmount
        ? receiver.incomingAmount.value - receiver.receivedAmount.value
        : undefined
    maxReceiveAmountValue =
      receivingPaymentValue && receivingPaymentValue < quote.receiveAmount.value
        ? receivingPaymentValue
        : quote.receiveAmount.value
  }

  deps.logger.debug(
    {
      debitAmountValue: quote.debitAmount.value,
      receiveAmountValue: quote.receiveAmount.value,
      maxReceiveAmountValue
    },
    `Calculating ${maxReceiveAmountValue ? 'fixed-send' : 'fixed-delivery'} quote amount with fees`
  )

  const { debitAmountValue, debitAmountMinusFees, receiveAmountValue } =
    maxReceiveAmountValue
      ? calculateFixedSendQuoteAmounts(deps, quote, maxReceiveAmountValue)
      : calculateFixedDeliveryQuoteAmounts(deps, quote)

  const patchOptions = {
    debitAmountMinusFees,
    debitAmountValue,
    receiveAmountValue,
    expiresAt: calculateExpiry(deps, quote, receiver)
  }

  await quote.$query(deps.knex).patch(patchOptions)

  return quote
}

async function getWalletAddressPage(
  deps: ServiceDependencies,
  options: ListOptions
): Promise<Quote[]> {
  const quotes = await Quote.query(deps.knex)
    .modify((query) => {
      if (options.tenantId) {
        query.where({ tenantId: options.tenantId })
      }
    })
    .list(options)
    .withGraphFetched('fee')
  for (const quote of quotes) {
    const asset = await deps.assetService.get(quote.assetId)
    if (asset) quote.asset = asset

    quote.walletAddress = await deps.walletAddressService.get(
      quote.walletAddressId,
      quote.tenantId
    )
  }
  return quotes
}
