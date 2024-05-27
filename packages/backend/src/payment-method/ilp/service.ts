import { BaseService } from '../../shared/baseService'
import {
  PaymentQuote,
  PaymentMethodService,
  StartQuoteOptions,
  PayOptions
} from '../handler/service'
import { RatesService } from '../../rates/service'
import { IlpPlugin, IlpPluginOptions } from './ilp_plugin'
import * as Pay from '@interledger/pay'
import { convertRatesToIlpPrices } from './rates'
import { IAppConfig } from '../../config/app'
import { PaymentMethodHandlerError } from '../handler/errors'

export interface IlpPaymentService extends PaymentMethodService {}

interface ServiceDependencies extends BaseService {
  config: IAppConfig
  ratesService: RatesService
  makeIlpPlugin: (options: IlpPluginOptions) => IlpPlugin
}

export async function createIlpPaymentService(
  deps_: ServiceDependencies
): Promise<IlpPaymentService> {
  const deps: ServiceDependencies = {
    ...deps_,
    logger: deps_.logger.child({ service: 'IlpPaymentService' })
  }

  return {
    getQuote: (quoteOptions) => getQuote(deps, quoteOptions),
    pay: (payOptions) => pay(deps, payOptions)
  }
}

async function getQuote(
  deps: ServiceDependencies,
  options: StartQuoteOptions
): Promise<PaymentQuote> {
  const rates = await deps.ratesService
    .rates(options.walletAddress.asset.code)
    .catch((_err: Error) => {
      throw new PaymentMethodHandlerError('Received error during ILP quoting', {
        description: 'Could not get rates from service',
        retryable: false
      })
    })

  const plugin = deps.makeIlpPlugin({
    sourceAccount: options.walletAddress,
    unfulfillable: true
  })
  const destination = options.receiver.toResolvedPayment()

  try {
    await plugin.connect()
    const quoteOptions: Pay.QuoteOptions = {
      plugin,
      destination,
      sourceAsset: {
        scale: options.walletAddress.asset.scale,
        code: options.walletAddress.asset.code
      }
    }
    if (options.debitAmount) {
      quoteOptions.amountToSend = options.debitAmount.value
    } else {
      quoteOptions.amountToDeliver =
        options.receiveAmount?.value || options.receiver.incomingAmount?.value
    }

    let ilpQuote: Pay.Quote | undefined
    try {
      ilpQuote = await Pay.startQuote({
        ...quoteOptions,
        slippage: deps.config.slippage,
        prices: convertRatesToIlpPrices(rates)
      })
    } catch (err) {
      const errorMessage = 'Received error during ILP quoting'
      deps.logger.error({ err }, errorMessage)

      throw new PaymentMethodHandlerError(errorMessage, {
        description: Pay.isPaymentError(err) ? err : 'Unknown error',
        retryable: canRetryError(err as Error | Pay.PaymentError)
      })
    }
    // Pay.startQuote should return PaymentError.InvalidSourceAmount or
    // PaymentError.InvalidDestinationAmount for non-positive amounts.
    // Outgoing payments' sendAmount or receiveAmount should never be
    // zero or negative.
    if (ilpQuote.maxSourceAmount <= BigInt(0)) {
      throw new PaymentMethodHandlerError('Received error during ILP quoting', {
        description: 'Maximum source amount of ILP quote is non-positive',
        retryable: false
      })
    }

    if (ilpQuote.minDeliveryAmount <= BigInt(0)) {
      throw new PaymentMethodHandlerError('Received error during ILP quoting', {
        description: 'Minimum delivery amount of ILP quote is non-positive',
        retryable: false
      })
    }

    return {
      receiver: options.receiver,
      walletAddress: options.walletAddress,
      estimatedExchangeRate: ilpQuote.lowEstimatedExchangeRate.valueOf(),
      debitAmount: {
        value: ilpQuote.maxSourceAmount,
        assetCode: options.walletAddress.asset.code,
        assetScale: options.walletAddress.asset.scale
      },
      receiveAmount: {
        value: ilpQuote.minDeliveryAmount,
        assetCode: options.receiver.assetCode,
        assetScale: options.receiver.assetScale
      },
      additionalFields: {
        lowEstimatedExchangeRate: ilpQuote.lowEstimatedExchangeRate,
        highEstimatedExchangeRate: ilpQuote.highEstimatedExchangeRate,
        minExchangeRate: ilpQuote.minExchangeRate,
        maxPacketAmount: ilpQuote.maxPacketAmount
      }
    }
  } finally {
    try {
      await Pay.closeConnection(plugin, destination)
    } catch (error) {
      deps.logger.warn(
        {
          destination: destination.destinationAddress,
          error: error instanceof Error && error.message
        },
        'close quote connection failed'
      )
    }

    try {
      await plugin.disconnect()
    } catch (error) {
      deps.logger.warn(
        { error: error instanceof Error && error.message },
        'error disconnecting ilp plugin'
      )
    }
  }
}

async function pay(
  deps: ServiceDependencies,
  options: PayOptions
): Promise<void> {
  const { receiver, outgoingPayment, finalDebitAmount, finalReceiveAmount } =
    options

  if (finalReceiveAmount <= 0n) {
    throw new PaymentMethodHandlerError('Could not start ILP streaming', {
      description: 'Invalid finalReceiveAmount',
      retryable: false
    })
  }

  if (finalDebitAmount <= 0n) {
    throw new PaymentMethodHandlerError('Could not start ILP streaming', {
      description: 'Invalid finalDebitAmount',
      retryable: false
    })
  }

  const {
    lowEstimatedExchangeRate,
    highEstimatedExchangeRate,
    minExchangeRate,
    maxPacketAmount
  } = outgoingPayment.quote

  const quote: Pay.Quote = {
    maxPacketAmount,
    paymentType: Pay.PaymentType.FixedDelivery,
    maxSourceAmount: finalDebitAmount,
    minDeliveryAmount: finalReceiveAmount,
    lowEstimatedExchangeRate,
    highEstimatedExchangeRate,
    minExchangeRate
  }

  const plugin = deps.makeIlpPlugin({
    sourceAccount: outgoingPayment
  })

  const destination = receiver.toResolvedPayment()

  try {
    const receipt = await Pay.pay({ plugin, destination, quote })

    if (receipt.error) {
      throw receipt.error
    }

    deps.logger.debug(
      {
        destination: destination.destinationAddress,
        error: receipt.error,
        finalDebitAmount,
        finalReceiveAmount,
        receiptAmountSent: receipt.amountSent,
        receiptAmountDelivered: receipt.amountDelivered
      },
      'ILP payment completed'
    )
  } catch (err) {
    const errorMessage = 'Received error during ILP pay'
    deps.logger.error(
      { err, destination: destination.destinationAddress },
      errorMessage
    )

    throw new PaymentMethodHandlerError(errorMessage, {
      description: Pay.isPaymentError(err) ? err : 'Unknown error',
      retryable: canRetryError(err as Error | Pay.PaymentError)
    })
  } finally {
    try {
      await Pay.closeConnection(plugin, destination)
    } catch (error) {
      deps.logger.warn(
        {
          destination: destination.destinationAddress,
          error: error instanceof Error && error.message
        },
        'close pay connection failed'
      )
    }

    try {
      await plugin.disconnect()
    } catch (error) {
      deps.logger.warn(
        { error: error instanceof Error && error.message },
        'error disconnecting plugin'
      )
    }
  }
}

export function canRetryError(err: Error | Pay.PaymentError): boolean {
  return err instanceof Error || !!retryableIlpErrors[err]
}

export const retryableIlpErrors: {
  [paymentError in Pay.PaymentError]?: boolean
} = {
  [Pay.PaymentError.ConnectorError]: true,
  [Pay.PaymentError.EstablishmentFailed]: true,
  [Pay.PaymentError.InsufficientExchangeRate]: true,
  [Pay.PaymentError.RateProbeFailed]: true,
  [Pay.PaymentError.IdleTimeout]: true,
  [Pay.PaymentError.ClosedByReceiver]: true
}
