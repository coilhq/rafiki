import { IocContract } from '@adonisjs/fold'
import * as Pay from '@interledger/pay'

import { randomAsset } from './asset'
import { AppServices } from '../app'
import { AssetOptions } from '../asset/service'
import { Quote } from '../open_payments/quote/model'
import { CreateQuoteOptions } from '../open_payments/quote/service'
import { PaymentQuote } from '../payment-method/handler/service'
import { WalletAddress } from '../open_payments/wallet_address/model'
import { Receiver } from '../open_payments/receiver/model'
import { IlpQuoteDetails } from '../payment-method/ilp/quote-details/model'
import { v4 as uuid } from 'uuid'

export type CreateTestQuoteOptions = CreateQuoteOptions & {
  exchangeRate?: number
  validDestination?: boolean
  withFee?: boolean
}

type MockQuoteArgs = {
  receiver: Receiver
  walletAddress: WalletAddress
  exchangeRate?: number
} & ({ debitAmountValue: bigint } | { receiveAmountValue: bigint })

export function mockQuote(
  args: MockQuoteArgs,
  overrides?: Partial<PaymentQuote>
): PaymentQuote {
  const { walletAddress, receiver, exchangeRate = 1 } = args

  return {
    receiver,
    walletAddress,
    debitAmount: {
      assetCode: walletAddress.asset.code,
      assetScale: walletAddress.asset.scale,
      value:
        'debitAmountValue' in args
          ? args.debitAmountValue
          : BigInt(Math.ceil(Number(args.receiveAmountValue) * exchangeRate))
    },
    receiveAmount: {
      assetCode: receiver.assetCode,
      assetScale: receiver.assetScale,
      value:
        'receiveAmountValue' in args
          ? args.receiveAmountValue
          : BigInt(Math.ceil(Number(args.debitAmountValue) * exchangeRate))
    },
    estimatedExchangeRate: exchangeRate,
    ...overrides
  }
}

export async function createQuote(
  deps: IocContract<AppServices>,
  {
    tenantId,
    walletAddressId,
    receiver: receiverUrl,
    debitAmount,
    receiveAmount,
    client,
    /* eslint-disable @typescript-eslint/no-unused-vars */
    method,
    validDestination = true,
    withFee = false,
    exchangeRate = 0.5
  }: CreateTestQuoteOptions
): Promise<Quote> {
  const walletAddressService = await deps.use('walletAddressService')
  const walletAddress = await walletAddressService.get(
    walletAddressId,
    tenantId
  )
  if (!walletAddress) {
    throw new Error('wallet not found')
  }
  if (
    debitAmount &&
    (walletAddress.asset.code !== debitAmount.assetCode ||
      walletAddress.asset.scale !== debitAmount.assetScale)
  ) {
    throw new Error('asset code or scale do not match')
  }

  const config = await deps.use('config')
  let receiveAsset: AssetOptions | undefined
  if (validDestination) {
    const receiverService = await deps.use('receiverService')
    const receiver = await receiverService.get(receiverUrl)
    if (!receiver) {
      throw new Error('receiver not found')
    }
    if (!receiver.incomingAmount && !receiveAmount && !debitAmount) {
      throw new Error('missing amount')
    }
    if (receiveAmount) {
      if (
        receiver.assetCode !== receiveAmount.assetCode ||
        receiver.assetScale !== receiveAmount.assetScale
      ) {
        throw new Error('asset code or asset scale do not match')
      }
      if (
        receiver.incomingAmount &&
        receiveAmount.value > receiver.incomingAmount.value
      ) {
        throw new Error('receive amount is higher than the incoming amount')
      }
    } else {
      receiveAsset = receiver.asset
      if (!debitAmount) {
        receiveAmount = receiver.incomingAmount
      }
    }
  } else {
    receiveAsset = randomAsset()
    if (!debitAmount && !receiveAmount) {
      receiveAmount = {
        value: BigInt(56),
        assetCode: receiveAsset.code,
        assetScale: receiveAsset.scale
      }
    }
  }

  if (debitAmount) {
    if (!receiveAsset) {
      throw new Error('receive asset is not defined')
    }
    receiveAmount = {
      value: BigInt(
        Math.ceil(
          Number(debitAmount.value) /
            ((1 / exchangeRate) * (1 + config.slippage))
        )
      ),
      assetCode: receiveAsset.code,
      assetScale: receiveAsset.scale
    }
  } else {
    if (!receiveAmount) {
      throw new Error('receive amount is not defined')
    }
    debitAmount = {
      value: BigInt(
        Math.ceil(
          Number(receiveAmount.value) *
            (1 / exchangeRate) *
            (1 + config.slippage)
        )
      ),
      assetCode: walletAddress.asset.code,
      assetScale: walletAddress.asset.scale
    }
  }

  const quoteId = uuid()
  await IlpQuoteDetails.query().insert({
    quoteId,
    lowEstimatedExchangeRate: Pay.Ratio.from(exchangeRate),
    highEstimatedExchangeRate: Pay.Ratio.from(
      exchangeRate + 0.000000000001
    ) as unknown as Pay.PositiveRatio,
    minExchangeRate: Pay.Ratio.from(exchangeRate * 0.99),
    maxPacketAmount: BigInt('9223372036854775807')
  })

  const withGraphFetchedArray = ['asset', 'walletAddress.asset']
  if (withFee) {
    withGraphFetchedArray.push('fee')
  }
  const withGraphFetchedExpression = `[${withGraphFetchedArray.join(', ')}]`

  return Quote.query()
    .insertAndFetch({
      id: quoteId,
      tenantId,
      walletAddressId,
      assetId: walletAddress.assetId,
      receiver: receiverUrl,
      debitAmount,
      debitAmountMinusFees: debitAmount.value,
      receiveAmount,
      estimatedExchangeRate: exchangeRate,
      expiresAt: new Date(Date.now() + config.quoteLifespan),
      client
    })
    .withGraphFetched(withGraphFetchedExpression)
}
