import { Model, Pojo } from 'objection'
import { LiquidityAccount, OnDebitOptions } from '../accounting/service'
import { Asset } from '../asset/model'
import { ConnectorAccount } from '../connector/core/rafiki'
import { HttpToken } from '../httpToken/model'
import { BaseModel } from '../shared/baseModel'

export class Peer
  extends BaseModel
  implements ConnectorAccount, LiquidityAccount
{
  public static get tableName(): string {
    return 'peers'
  }

  static relationMappings = {
    asset: {
      relation: Model.HasOneRelation,
      modelClass: Asset,
      join: {
        from: 'peers.assetId',
        to: 'assets.id'
      }
    },
    incomingTokens: {
      relation: Model.HasManyRelation,
      modelClass: HttpToken,
      join: {
        from: 'peers.id',
        to: 'httpTokens.peerId'
      }
    }
  }

  public readonly liquidityThreshold!: bigint | null
  public processAt!: Date | null

  public assetId!: string
  public asset!: Asset

  public http!: {
    outgoing: {
      authToken: string
      endpoint: string
    }
  }

  public maxPacketAmount?: bigint

  public staticIlpAddress!: string

  public name?: string

  public async onDebit({ balance }: OnDebitOptions): Promise<Peer> {
    if (this.liquidityThreshold !== null) {
      if (balance <= this.liquidityThreshold) {
        await this.$query().patch({
          processAt: new Date(Date.now())
        })
      }
    }
    return this
  }

  $formatDatabaseJson(json: Pojo): Pojo {
    if (json.http?.outgoing) {
      json.outgoingToken = json.http.outgoing.authToken
      json.outgoingEndpoint = json.http.outgoing.endpoint
      delete json.http
    }
    return super.$formatDatabaseJson(json)
  }

  $parseDatabaseJson(json: Pojo): Pojo {
    const formattedJson = super.$parseDatabaseJson(json)
    if (formattedJson.outgoingToken) {
      formattedJson.http = {
        outgoing: {
          authToken: formattedJson.outgoingToken,
          endpoint: formattedJson.outgoingEndpoint
        }
      }
      delete formattedJson.outgoingToken
      delete formattedJson.outgoingEndpoint
    }
    return formattedJson
  }
}
