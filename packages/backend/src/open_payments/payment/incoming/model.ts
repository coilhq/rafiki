import { Model, QueryContext } from 'objection'

import { Amount, AmountJSON, serializeAmount } from '../../amount'
import { IlpStreamCredentials } from '../../../payment-method/ilp/stream-credentials/service'
import {
  WalletAddress,
  WalletAddressSubresource
} from '../../wallet_address/model'
import { Asset } from '../../../asset/model'
import { LiquidityAccount, OnCreditOptions } from '../../../accounting/service'
import { ConnectorAccount } from '../../../payment-method/ilp/connector/core/rafiki'
import { WebhookEvent } from '../../../webhook/model'
import {
  IncomingPayment as OpenPaymentsIncomingPayment,
  IncomingPaymentWithPaymentMethods as OpenPaymentsIncomingPaymentWithPaymentMethod
} from '@interledger/open-payments'
import base64url from 'base64url'

export enum IncomingPaymentEventType {
  IncomingPaymentCreated = 'incoming_payment.created',
  IncomingPaymentExpired = 'incoming_payment.expired',
  IncomingPaymentCompleted = 'incoming_payment.completed'
}

export enum IncomingPaymentState {
  // The payment has a state of `PENDING` when it is initially created.
  Pending = 'PENDING',
  // As soon as payment has started (funds have cleared into the account) the state moves to `PROCESSING`.
  Processing = 'PROCESSING',
  // The payment is either auto-completed once the received amount equals the expected `incomingAmount`,
  // or it is completed manually via an API call.
  Completed = 'COMPLETED',
  // If the payment expires before it is completed then the state will move to `EXPIRED`
  // and no further payments will be accepted.
  Expired = 'EXPIRED'
}

export interface IncomingPaymentResponse {
  id: string
  walletAddressId: string
  client?: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  incomingAmount?: AmountJSON
  receivedAmount: AmountJSON
  completed: boolean
  metadata?: Record<string, unknown>
  approvedAt?: string
  cancelledAt?: string
}

export type IncomingPaymentData = IncomingPaymentResponse &
  Record<string, unknown>

export enum IncomingPaymentEventError {
  IncomingPaymentIdRequired = 'Incoming Payment ID is required for incoming payment events'
}

export class IncomingPaymentEvent extends WebhookEvent {
  public type!: IncomingPaymentEventType
  public data!: IncomingPaymentData

  public $beforeInsert(context: QueryContext): void {
    super.$beforeInsert(context)

    if (!this.incomingPaymentId) {
      throw new Error(IncomingPaymentEventError.IncomingPaymentIdRequired)
    }
  }
}

export class IncomingPayment
  extends WalletAddressSubresource
  implements ConnectorAccount, LiquidityAccount
{
  public static get tableName(): string {
    return 'incomingPayments'
  }
  public static readonly urlPath = '/incoming-payments'

  static get virtualAttributes(): string[] {
    return ['completed', 'incomingAmount', 'receivedAmount', 'url']
  }

  static get relationMappings() {
    return {
      ...super.relationMappings,
      asset: {
        relation: Model.HasOneRelation,
        modelClass: Asset,
        join: {
          from: 'incomingPayments.assetId',
          to: 'assets.id'
        }
      }
    }
  }

  public expiresAt!: Date
  public state!: IncomingPaymentState
  public metadata?: Record<string, unknown>

  public processAt!: Date | null
  public approvedAt?: Date | null
  public cancelledAt?: Date | null

  public readonly assetId!: string
  public asset!: Asset

  private incomingAmountValue?: bigint | null
  private receivedAmountValue?: bigint
  public readonly tenantId!: string

  public get completed(): boolean {
    return this.state === IncomingPaymentState.Completed
  }

  public get incomingAmount(): Amount | undefined {
    if (this.incomingAmountValue) {
      return {
        value: this.incomingAmountValue,
        assetCode: this.asset.code,
        assetScale: this.asset.scale
      }
    }
    return undefined
  }

  public set incomingAmount(amount: Amount | undefined) {
    this.incomingAmountValue = amount?.value ?? null
  }

  public get receivedAmount(): Amount {
    return {
      value: this.receivedAmountValue || BigInt(0),
      assetCode: this.asset.code,
      assetScale: this.asset.scale
    }
  }

  public set receivedAmount(amount: Amount) {
    this.receivedAmountValue = amount.value
  }

  public getUrl(walletAddress: WalletAddress): string {
    const url = new URL(walletAddress.url)
    return `${url.origin}/${walletAddress.tenantId}${IncomingPayment.urlPath}/${this.id}`
  }

  public async onCredit({
    totalReceived
  }: OnCreditOptions): Promise<IncomingPayment> {
    let incomingPayment
    if (this.incomingAmount && this.incomingAmount.value <= totalReceived) {
      incomingPayment = await IncomingPayment.query()
        .patchAndFetchById(this.id, {
          state: IncomingPaymentState.Completed,
          processAt: new Date()
        })
        .whereNotIn('state', [
          IncomingPaymentState.Expired,
          IncomingPaymentState.Completed
        ])
    } else {
      incomingPayment = await IncomingPayment.query()
        .patchAndFetchById(this.id, {
          state: IncomingPaymentState.Processing
        })
        .whereNotIn('state', [
          IncomingPaymentState.Expired,
          IncomingPaymentState.Completed
        ])
    }
    if (incomingPayment) {
      return incomingPayment
    }
    return this
  }

  public isExpiredOrComplete(): boolean {
    return (
      this.state === IncomingPaymentState.Expired ||
      this.state === IncomingPaymentState.Completed
    )
  }

  public toData(amountReceived: bigint): IncomingPaymentData {
    const data: IncomingPaymentData = {
      id: this.id,
      walletAddressId: this.walletAddressId,
      client: this.client,
      createdAt: new Date(+this.createdAt).toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      receivedAmount: {
        value: amountReceived.toString(),
        assetCode: this.asset.code,
        assetScale: this.asset.scale
      },
      completed: this.completed,
      updatedAt: new Date(+this.updatedAt).toISOString()
    }

    if (this.incomingAmount) {
      data.incomingAmount = {
        ...this.incomingAmount,
        value: this.incomingAmount.value.toString()
      }
    }
    if (this.metadata) {
      data.metadata = this.metadata
    }
    if (this.approvedAt) {
      data.approvedAt = new Date(this.approvedAt).toISOString()
    }
    if (this.cancelledAt) {
      data.cancelledAt = new Date(this.cancelledAt).toISOString()
    }

    return data
  }

  public toOpenPaymentsType(
    walletAddress: WalletAddress
  ): OpenPaymentsIncomingPayment {
    return {
      id: this.getUrl(walletAddress),
      walletAddress: walletAddress.url,
      incomingAmount: this.incomingAmount
        ? serializeAmount(this.incomingAmount)
        : undefined,
      receivedAmount: serializeAmount(this.receivedAmount),
      completed: this.completed,
      metadata: this.metadata ?? undefined,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      expiresAt: this.expiresAt.toISOString()
    }
  }

  public toOpenPaymentsTypeWithMethods(
    walletAddress: WalletAddress,
    ilpStreamCredentials?: IlpStreamCredentials
  ): OpenPaymentsIncomingPaymentWithPaymentMethod {
    return {
      ...this.toOpenPaymentsType(walletAddress),
      methods:
        this.isExpiredOrComplete() || !ilpStreamCredentials
          ? []
          : [
              {
                type: 'ilp',
                ilpAddress: ilpStreamCredentials.ilpAddress,
                sharedSecret: base64url(ilpStreamCredentials.sharedSecret)
              }
            ]
    }
  }

  public toPublicOpenPaymentsType(authServerUrl: string): {
    receivedAmount: OpenPaymentsIncomingPayment['receivedAmount']
    authServer: string
  } {
    return {
      receivedAmount: serializeAmount(this.receivedAmount),
      authServer: authServerUrl
    }
  }
}
