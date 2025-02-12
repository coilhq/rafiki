import { Model, ModelOptions, QueryContext } from 'objection'
import { DbErrors } from 'objection-db-errors'

import { LiquidityAccount } from '../../../accounting/service'
import { Asset } from '../../../asset/model'
import { ConnectorAccount } from '../../../payment-method/ilp/connector/core/rafiki'
import {
  WalletAddressSubresource,
  WalletAddress
} from '../../wallet_address/model'
import { Quote } from '../../quote/model'
import { Amount, AmountJSON, serializeAmount } from '../../amount'
import { WebhookEvent } from '../../../webhook/model'
import {
  OutgoingPayment as OpenPaymentsOutgoingPayment,
  OutgoingPaymentWithSpentAmounts
} from '@interledger/open-payments'
import { Tenant } from '../../../tenants/model'

export class OutgoingPaymentGrant extends DbErrors(Model) {
  public static get modelPaths(): string[] {
    return [__dirname]
  }
  public static readonly tableName = 'outgoingPaymentGrants'
  public id!: string
}

export class OutgoingPayment
  extends WalletAddressSubresource
  implements ConnectorAccount, LiquidityAccount
{
  public static readonly tableName = 'outgoingPayments'
  public static readonly urlPath = '/outgoing-payments'

  static get virtualAttributes(): string[] {
    return [
      'debitAmount',
      'receiveAmount',
      'quote',
      'sentAmount',
      'receiver',
      'grantSpentDebitAmount',
      'grantSpentReceiveAmount'
    ]
  }

  public state!: OutgoingPaymentState
  // The "| null" is necessary so that `$beforeUpdate` can modify a patch to remove the error. If `$beforeUpdate` set `error = undefined`, the patch would ignore the modification.
  public error?: string | null
  public stateAttempts!: number

  public grantId?: string

  public get receiver(): string {
    return this.quote.receiver
  }

  public get debitAmount(): Amount {
    return this.quote.debitAmount
  }

  private sentAmountValue?: bigint

  public get sentAmount(): Amount {
    return {
      value: this.sentAmountValue || BigInt(0),
      assetCode: this.asset.code,
      assetScale: this.asset.scale
    }
  }
  public set sentAmount(amount: Amount) {
    this.sentAmountValue = amount.value
  }
  public get receiveAmount(): Amount {
    return this.quote.receiveAmount
  }

  private grantSpentReceiveAmountValue?: bigint
  public get grantSpentReceiveAmount(): Amount {
    return {
      value: this.grantSpentReceiveAmountValue || BigInt(0),
      assetCode: this.receiveAmount.assetCode,
      assetScale: this.receiveAmount.assetScale
    }
  }
  public set grantSpentReceiveAmount(amount: Amount) {
    this.grantSpentReceiveAmountValue = amount.value
  }

  private grantSpentDebitAmountValue?: bigint
  public get grantSpentDebitAmount(): Amount {
    return {
      value: this.grantSpentDebitAmountValue || BigInt(0),
      assetCode: this.debitAmount.assetCode,
      assetScale: this.debitAmount.assetScale
    }
  }
  public set grantSpentDebitAmount(amount: Amount) {
    this.grantSpentDebitAmountValue = amount.value
  }

  public metadata?: Record<string, unknown>

  public quote!: Quote

  public get assetId(): string {
    return this.quote.assetId
  }

  public getUrl(walletAddress: WalletAddress): string {
    const url = new URL(walletAddress.url)
    return `${url.origin}/${this.tenantId}${OutgoingPayment.urlPath}/${this.id}`
  }

  public get asset(): Asset {
    return this.quote.asset
  }

  public get failed(): boolean {
    return [
      OutgoingPaymentState.Cancelled,
      OutgoingPaymentState.Failed
    ].includes(this.state)
  }

  // Outgoing peer
  public peerId?: string

  public tenantId!: string

  static get relationMappings() {
    return {
      ...super.relationMappings,
      quote: {
        relation: Model.HasOneRelation,
        modelClass: Quote,
        join: {
          from: 'outgoingPayments.id',
          to: 'quotes.id'
        }
      },
      tenant: {
        relation: Model.BelongsToOneRelation,
        modelClass: Tenant,
        join: {
          from: 'outgoingPayments.tenantId',
          to: 'tenants.id'
        }
      }
    }
  }

  $beforeUpdate(opts: ModelOptions, queryContext: QueryContext): void {
    super.$beforeUpdate(opts, queryContext)
    if (opts.old && this.state) {
      if (!this.stateAttempts) {
        this.stateAttempts = 0
      }
    }
  }

  public toData({
    amountSent,
    balance
  }: {
    amountSent: bigint
    balance: bigint
  }): PaymentData {
    const data: PaymentData = {
      id: this.id,
      walletAddressId: this.walletAddressId,
      client: this.client,
      state: this.state,
      receiver: this.receiver,
      debitAmount: {
        ...this.debitAmount,
        value: this.debitAmount.value.toString()
      },
      receiveAmount: {
        ...this.receiveAmount,
        value: this.receiveAmount.value.toString()
      },
      sentAmount: {
        ...this.debitAmount,
        value: amountSent.toString()
      },
      stateAttempts: this.stateAttempts,
      createdAt: new Date(+this.createdAt).toISOString(),
      updatedAt: new Date(+this.updatedAt).toISOString(),
      balance: balance.toString()
    }
    if (this.metadata) {
      data.metadata = this.metadata
    }
    if (this.error) {
      data.error = this.error
    }
    if (this.peerId) {
      data.peerId = this.peerId
    }
    return data
  }

  public toOpenPaymentsType(
    walletAddress: WalletAddress
  ): OpenPaymentsOutgoingPayment {
    return {
      id: this.getUrl(walletAddress),
      walletAddress: walletAddress.url,
      quoteId: this.quote?.getUrl(walletAddress) ?? undefined,
      receiveAmount: serializeAmount(this.receiveAmount),
      debitAmount: serializeAmount(this.debitAmount),
      sentAmount: serializeAmount(this.sentAmount),
      receiver: this.receiver,
      failed: this.failed,
      metadata: this.metadata ?? undefined,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  public toOpenPaymentsWithSpentAmountsType(
    walletAddress: WalletAddress
  ): OutgoingPaymentWithSpentAmounts {
    return {
      ...this.toOpenPaymentsType(walletAddress),
      grantSpentReceiveAmount: serializeAmount(this.grantSpentReceiveAmount),
      grantSpentDebitAmount: serializeAmount(this.grantSpentDebitAmount)
    }
  }
}

export enum OutgoingPaymentState {
  // Initial state.
  // Awaiting money from the user's wallet account to be deposited to the payment account to reserve it for the payment.
  // On success, transition to `SENDING`.
  // On failure, transition to `FAILED`.
  // Can also go to CANCELLED state if cancelOutgoingPayment mutation is called
  Funding = 'FUNDING',
  // Pay from the account to the destination.
  // On success, transition to `COMPLETED`.
  Sending = 'SENDING',
  // The payment failed. (Though some money may have been delivered).
  Failed = 'FAILED',
  // Successful completion.
  Completed = 'COMPLETED',
  // Transaction has been cancelled by ASE
  Cancelled = 'CANCELLED'
}

export enum OutgoingPaymentDepositType {
  PaymentCreated = 'outgoing_payment.created'
}

export enum OutgoingPaymentWithdrawType {
  PaymentFailed = 'outgoing_payment.failed',
  PaymentCompleted = 'outgoing_payment.completed'
}

export const OutgoingPaymentEventType = {
  ...OutgoingPaymentDepositType,
  ...OutgoingPaymentWithdrawType
}
export type OutgoingPaymentEventType =
  | OutgoingPaymentDepositType
  | OutgoingPaymentWithdrawType

export interface OutgoingPaymentResponse {
  id: string
  walletAddressId: string
  client?: string
  createdAt: string
  receiver: string
  debitAmount: AmountJSON
  receiveAmount: AmountJSON
  metadata?: Record<string, unknown>
  failed: boolean
  updatedAt: string
  sentAmount: AmountJSON
}

export type PaymentData = Omit<OutgoingPaymentResponse, 'failed'> & {
  error?: string
  state: OutgoingPaymentState
  stateAttempts: number
  balance: string
  peerId?: string
}

export const isOutgoingPaymentEventType = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  o: any
): o is OutgoingPaymentEventType =>
  Object.values(OutgoingPaymentEventType).includes(o)

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const isOutgoingPaymentEvent = (o: any): o is OutgoingPaymentEvent =>
  o instanceof WebhookEvent && isOutgoingPaymentEventType(o.type)

export enum OutgoingPaymentEventError {
  OutgoingPaymentIdRequired = 'Outgoing Payment ID is required for outgoing payment events'
}

export class OutgoingPaymentEvent extends WebhookEvent {
  public type!: OutgoingPaymentEventType
  public data!: PaymentData

  public $beforeInsert(context: QueryContext): void {
    super.$beforeInsert(context)

    if (!this.outgoingPaymentId) {
      throw new Error(OutgoingPaymentEventError.OutgoingPaymentIdRequired)
    }
  }
}
