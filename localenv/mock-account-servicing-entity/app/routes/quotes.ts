import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'

import { CONFIG } from '~/lib/parse_config.server'

export type Amount = {
  value: string // bigint
  assetCode: string
  assetScale: number
}

enum PaymentType {
  FixedSend = 'FixedSend',
  FixedDelivery = 'FixedDelivery'
}

export type Quote = {
  id: string
  paymentType: PaymentType
  paymentPointerId: string
  receiver: string
  sendAmount: Amount
  receiveAmount: Amount
  maxPacketAmount: number // bigint
  minExchangeRate: number
  lowEstimatedExchangeRate: number
  highEstimatedExchangeRate: number
  createdAt: string
  expiresAt: string
}

export async function action({ request }: ActionArgs) {
  const receivedQuote: Quote = await request.json()

  const fee = CONFIG.seed.sendingFee
  const supportedAssets = CONFIG.seed.assets.map(({ code }) => code)

  if (receivedQuote.paymentType == PaymentType.FixedDelivery) {
    // TODO: handle quote fee calculation for different assets
    if (!supportedAssets.includes(receivedQuote.sendAmount.assetCode)) {
      throw json('Invalid quote sendAmount asset', { status: 400 })
    }
    const sendAmountValue = BigInt(receivedQuote.sendAmount.value)
    const fees =
      // TODO: bigint/float multiplication
      BigInt(Math.floor(Number(sendAmountValue) * fee.percentage)) +
      BigInt(fee.fixed * Math.pow(10, receivedQuote.sendAmount.assetScale))

    receivedQuote.sendAmount.value = (sendAmountValue + fees).toString()
  } else if (receivedQuote.paymentType === PaymentType.FixedSend) {
    if (!supportedAssets.includes(receivedQuote.receiveAmount.assetCode)) {
      throw json('Invalid quote receiveAmount asset', { status: 400 })
    }
    const receiveAmountValue = BigInt(receivedQuote.receiveAmount.value)
    const fees =
      BigInt(Math.floor(Number(receiveAmountValue) * fee.percentage)) +
      BigInt(fee.fixed * Math.pow(10, receivedQuote.receiveAmount.assetScale))

    if (receiveAmountValue <= fees) {
      throw json('Fees exceed quote receiveAmount', { status: 400 })
    }

    receivedQuote.receiveAmount.value = (receiveAmountValue - fees).toString()
  } else throw json('Invalid paymentType', { status: 400 })

  return json(receivedQuote, { status: 201 })
}
