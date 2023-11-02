import { Counter, ResolvedPayment } from '@interledger/pay'
import base64url from 'base64url'

import { Amount, parseAmount } from '../amount'
import { AssetOptions } from '../../asset/service'
import { IncomingPaymentWithPaymentMethods as OpenPaymentsIncomingPaymentWithPaymentMethod } from '@interledger/open-payments'
import { IlpAddress, isValidIlpAddress } from 'ilp-packet'

type ReceiverIncomingPayment = Readonly<
  Omit<
    OpenPaymentsIncomingPaymentWithPaymentMethod,
    | 'expiresAt'
    | 'receivedAmount'
    | 'incomingAmount'
    | 'createdAt'
    | 'updatedAt'
  > & {
    expiresAt?: Date
    createdAt: Date
    updatedAt: Date
    receivedAmount: Amount
    incomingAmount?: Amount
  }
>

export class Receiver {
  public readonly ilpAddress: IlpAddress
  public readonly sharedSecret: Buffer
  public readonly assetCode: string
  public readonly assetScale: number
  public readonly incomingPayment: ReceiverIncomingPayment

  constructor(incomingPayment: OpenPaymentsIncomingPaymentWithPaymentMethod) {
    if (incomingPayment.completed) {
      throw new Error('Cannot create receiver from completed incoming payment')
    }

    const expiresAt = incomingPayment.expiresAt
      ? new Date(incomingPayment.expiresAt)
      : undefined

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new Error('Cannot create receiver from expired incoming payment')
    }

    if (!incomingPayment.methods.length) {
      throw new Error('Missing payment method(s) on incoming payment')
    }

    const incomingAmount = incomingPayment.incomingAmount
      ? parseAmount(incomingPayment.incomingAmount)
      : undefined
    const receivedAmount = parseAmount(incomingPayment.receivedAmount)

    // TODO: handle multiple payment methods
    const ilpMethod = incomingPayment.methods.find(
      (method) => method.type === 'ilp'
    )
    if (!ilpMethod) {
      throw new Error('Cannot create receiver from unsupported payment method')
    }
    if (!isValidIlpAddress(ilpMethod.ilpAddress)) {
      throw new Error('Invalid ILP address on ilp payment method')
    }

    this.ilpAddress = ilpMethod.ilpAddress
    this.sharedSecret = base64url.toBuffer(ilpMethod.sharedSecret)
    this.assetCode = incomingPayment.receivedAmount.assetCode
    this.assetScale = incomingPayment.receivedAmount.assetScale

    this.incomingPayment = {
      ...incomingPayment,
      expiresAt,
      receivedAmount,
      incomingAmount,
      createdAt: new Date(incomingPayment.createdAt),
      updatedAt: new Date(incomingPayment.updatedAt)
    }
  }

  public get asset(): AssetOptions {
    return {
      code: this.assetCode,
      scale: this.assetScale
    }
  }

  public get incomingAmount(): Amount | undefined {
    if (this.incomingPayment?.incomingAmount) {
      return {
        value: this.incomingPayment.incomingAmount.value,
        assetCode: this.assetCode,
        assetScale: this.assetScale
      }
    }
    return undefined
  }

  public get receivedAmount(): Amount | undefined {
    if (this.incomingPayment?.receivedAmount) {
      return {
        value: this.incomingPayment.receivedAmount.value,
        assetCode: this.assetCode,
        assetScale: this.assetScale
      }
    }
    return undefined
  }

  public toResolvedPayment(): ResolvedPayment {
    return {
      destinationAsset: this.asset,
      destinationAddress: this.ilpAddress,
      sharedSecret: this.sharedSecret,
      requestCounter: Counter.from(0) as Counter
    }
  }
}
