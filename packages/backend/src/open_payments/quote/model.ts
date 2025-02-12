import { Model, Pojo } from 'objection'
import { Amount, serializeAmount } from '../amount'
import {
  WalletAddress,
  WalletAddressSubresource
} from '../wallet_address/model'
import { Asset } from '../../asset/model'
import { Quote as OpenPaymentsQuote } from '@interledger/open-payments'
import { Fee } from '../../fee/model'
import { Tenant } from '../../tenants/model'

export class Quote extends WalletAddressSubresource {
  public static readonly tableName = 'quotes'
  public static readonly urlPath = '/quotes'

  static get virtualAttributes(): string[] {
    return ['debitAmount', 'receiveAmount', 'method']
  }

  // Asset id of the sender
  public assetId!: string
  public asset!: Asset

  public estimatedExchangeRate!: number
  public feeId?: string
  public fee?: Fee

  public debitAmountMinusFees?: bigint

  public tenantId!: string

  static get relationMappings() {
    return {
      ...super.relationMappings,
      asset: {
        relation: Model.HasOneRelation,
        modelClass: Asset,
        join: {
          from: 'quotes.assetId',
          to: 'assets.id'
        }
      },
      fee: {
        relation: Model.HasOneRelation,
        modelClass: Fee,
        join: {
          from: 'quotes.feeId',
          to: 'fees.id'
        }
      },
      tenant: {
        relation: Model.BelongsToOneRelation,
        modelClass: Tenant,
        join: {
          from: 'quotes.tenantId',
          to: 'tenants.id'
        }
      }
    }
  }

  public expiresAt!: Date

  public receiver!: string

  private debitAmountValue!: bigint

  public getUrl(walletAddress: WalletAddress): string {
    const url = new URL(walletAddress.url)
    return `${url.origin}/${this.tenantId}${Quote.urlPath}/${this.id}`
  }

  public get debitAmount(): Amount {
    return {
      value: this.debitAmountValue,
      assetCode: this.asset.code,
      assetScale: this.asset.scale
    }
  }

  public set debitAmount(amount: Amount) {
    this.debitAmountValue = amount.value
  }

  private receiveAmountValue!: bigint
  private receiveAmountAssetCode!: string
  private receiveAmountAssetScale!: number

  public get receiveAmount(): Amount {
    return {
      value: this.receiveAmountValue,
      assetCode: this.receiveAmountAssetCode,
      assetScale: this.receiveAmountAssetScale
    }
  }

  public set receiveAmount(amount: Amount) {
    this.receiveAmountValue = amount.value
    this.receiveAmountAssetCode = amount.assetCode
    this.receiveAmountAssetScale = amount?.assetScale
  }

  public get maxSourceAmount(): bigint {
    return this.debitAmountValue
  }

  public get minDeliveryAmount(): bigint {
    return this.receiveAmountValue
  }

  public get method(): 'ilp' {
    return 'ilp'
  }

  $formatJson(json: Pojo): Pojo {
    json = super.$formatJson(json)
    return {
      id: json.id,
      walletAddressId: json.walletAddressId,
      receiver: json.receiver,
      debitAmount: {
        ...json.debitAmount,
        value: json.debitAmount.value.toString()
      },
      receiveAmount: {
        ...json.receiveAmount,
        value: json.receiveAmount.value.toString()
      },
      createdAt: json.createdAt,
      expiresAt: json.expiresAt.toISOString()
    }
  }

  public toOpenPaymentsType(walletAddress: WalletAddress): OpenPaymentsQuote {
    return {
      id: this.getUrl(walletAddress),
      walletAddress: walletAddress.url,
      receiveAmount: serializeAmount(this.receiveAmount),
      debitAmount: serializeAmount(this.debitAmount),
      receiver: this.receiver,
      expiresAt: this.expiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      method: this.method
    }
  }
}
