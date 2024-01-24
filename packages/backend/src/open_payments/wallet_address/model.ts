import { Model, Page, QueryContext } from 'objection'
import { WalletAddress as OpenPaymentsWalletAddress } from '@interledger/open-payments'
import { LiquidityAccount, OnCreditOptions } from '../../accounting/service'
import { ConnectorAccount } from '../../payment-method/ilp/connector/core/rafiki'
import { Asset } from '../../asset/model'
import { BaseModel, Pagination, SortOrder } from '../../shared/baseModel'
import { WebhookEvent } from '../../webhook/model'
import { WalletAddressKey } from '../../open_payments/wallet_address/key/model'
import { AmountJSON } from '../amount'

export class WalletAddress
  extends BaseModel
  implements ConnectorAccount, LiquidityAccount
{
  public static get tableName(): string {
    return 'walletAddresses'
  }

  static relationMappings = () => ({
    asset: {
      relation: Model.HasOneRelation,
      modelClass: Asset,
      join: {
        from: 'walletAddresses.assetId',
        to: 'assets.id'
      }
    },
    keys: {
      relation: Model.HasManyRelation,
      modelClass: WalletAddressKey,
      join: {
        from: 'walletAddresses.id',
        to: 'walletAddressKeys.walletAddressId'
      }
    }
  })

  public keys?: WalletAddressKey[]

  public url!: string
  public publicName?: string

  public readonly assetId!: string
  public asset!: Asset

  // The cumulative received amount tracked by
  // `wallet_address.web_monetization` webhook events.
  // The value should be equivalent to the following query:
  // select sum(`withdrawalAmount`) from `webhookEvents` where `withdrawalAccountId` = `walletAddress.id`
  public totalEventsAmount!: bigint
  public processAt!: Date | null
  public deactivatedAt!: Date | null

  public get isActive() {
    return !this.deactivatedAt || this.deactivatedAt > new Date()
  }

  public async onCredit({
    totalReceived,
    withdrawalThrottleDelay
  }: OnCreditOptions): Promise<WalletAddress> {
    if (this.asset.withdrawalThreshold !== null) {
      const walletAddress = await WalletAddress.query()
        .patchAndFetchById(this.id, {
          processAt: new Date()
        })
        .whereRaw('?? <= ?', [
          'totalEventsAmount',
          totalReceived - this.asset.withdrawalThreshold
        ])
        .withGraphFetched('asset')
      if (walletAddress) {
        return walletAddress
      }
    }
    if (withdrawalThrottleDelay !== undefined && !this.processAt) {
      await this.$query().patch({
        processAt: new Date(Date.now() + withdrawalThrottleDelay)
      })
    }
    return this
  }

  public toData(received: bigint): WalletAddressData {
    return {
      walletAddress: {
        id: this.id,
        createdAt: new Date(+this.createdAt).toISOString(),
        receivedAmount: {
          value: received.toString(),
          assetCode: this.asset.code,
          assetScale: this.asset.scale
        }
      }
    }
  }

  public toOpenPaymentsType({
    authServer
  }: {
    authServer: string
  }): OpenPaymentsWalletAddress {
    return {
      id: this.url,
      publicName: this.publicName,
      assetCode: this.asset.code,
      assetScale: this.asset.scale,
      authServer
    }
  }
}

export enum WalletAddressEventType {
  WalletAddressWebMonetization = 'wallet_address.web_monetization',
  WalletAddressNotFound = 'wallet_address.not_found'
}

export type WalletAddressData = {
  walletAddress: {
    id: string
    createdAt: string
    receivedAmount: AmountJSON
  }
}

export type WalletAddressRequestedData = {
  walletAddressUrl: string
}

export enum WalletAddressEventError {
  WalletAddressIdRequired = 'Wallet Address ID is required for this wallet address event',
  WalletAddressIdProhibited = 'Wallet Address ID is not allowed for this wallet address event'
}

export class WalletAddressEvent extends WebhookEvent {
  public type!: WalletAddressEventType
  public data!: WalletAddressData | WalletAddressRequestedData

  public $beforeInsert(context: QueryContext): void {
    super.$beforeInsert(context)

    if (
      this.type === WalletAddressEventType.WalletAddressNotFound &&
      this.walletAddressId
    ) {
      throw new Error(WalletAddressEventError.WalletAddressIdProhibited)
    } else if (
      this.type !== WalletAddressEventType.WalletAddressNotFound &&
      !this.walletAddressId
    ) {
      throw new Error(WalletAddressEventError.WalletAddressIdRequired)
    }
  }
}

export interface GetOptions {
  id: string
  client?: string
  walletAddressId?: string
}

export interface ListOptions {
  walletAddressId: string
  client?: string
  pagination?: Pagination
  sortOrder?: SortOrder
}

class SubresourceQueryBuilder<
  M extends Model,
  R = M[]
> extends BaseModel.QueryBuilder<M, R> {
  ArrayQueryBuilderType!: SubresourceQueryBuilder<M, M[]>
  SingleQueryBuilderType!: SubresourceQueryBuilder<M, M>
  MaybeSingleQueryBuilderType!: SubresourceQueryBuilder<M, M | undefined>
  NumberQueryBuilderType!: SubresourceQueryBuilder<M, number>
  PageQueryBuilderType!: SubresourceQueryBuilder<M, Page<M>>

  get({ id, walletAddressId, client }: GetOptions) {
    if (walletAddressId) {
      this.where(
        `${this.modelClass().tableName}.walletAddressId`,
        walletAddressId
      )
    }
    if (client) {
      this.where({ client })
    }
    return this.findById(id)
  }
  list({ walletAddressId, client, pagination, sortOrder }: ListOptions) {
    if (client) {
      this.where({ client })
    }
    return this.getPage(pagination, sortOrder).where(
      `${this.modelClass().tableName}.walletAddressId`,
      walletAddressId
    )
  }
}

export abstract class WalletAddressSubresource extends BaseModel {
  public static readonly urlPath: string

  public readonly walletAddressId!: string
  public walletAddress?: WalletAddress

  public abstract readonly assetId: string
  public abstract asset: Asset

  public readonly client?: string

  static get relationMappings() {
    return {
      walletAddress: {
        relation: Model.BelongsToOneRelation,
        modelClass: WalletAddress,
        join: {
          from: `${this.tableName}.walletAddressId`,
          to: 'walletAddresses.id'
        }
      }
    }
  }

  QueryBuilderType!: SubresourceQueryBuilder<this>
  static QueryBuilder = SubresourceQueryBuilder
}
