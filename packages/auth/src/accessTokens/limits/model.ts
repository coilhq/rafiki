import { Model } from 'objection'
import { BaseModel } from '../../shared/baseModel'
import { AccessToken } from '../model'

enum LimitNames {
  SendAmount = 'sendAmount',
  ReceiveAmount = 'receiveAmount',
  CreatedBy = 'createdBy'
}

const AMOUNT_LIMITS = [LimitNames.SendAmount, LimitNames.ReceiveAmount]

interface AmountData {
  assetCode?: string
  assetScale?: number
}

export class Limit extends BaseModel {
  public static get tableName(): string {
    return 'limits'
  }

  static get virtualAttributes(): string[] {
    return ['data']
  }

  static relationMappings = {
    accessToken: {
      relation: Model.HasOneRelation,
      modelClass: AccessToken,
      join: {
        from: 'limit.accessToken',
        to: 'accessTokens.value'
      }
    }
  }

  public id!: string
  public name!: LimitNames
  public accessToken!: string
  public value?: bigint
  public assetCode?: string
  public assetScale?: number
  public createdById?: string

  get data(): string | AmountData | undefined {
    if (this.name === LimitNames.CreatedBy) {
      return this.createdById
    } else if (AMOUNT_LIMITS.includes(this.name)) {
      return {
        assetScale: this.assetScale,
        assetCode: this.assetCode
      }
    } else {
      throw new Error('unknown limit name')
    }
  }
}
