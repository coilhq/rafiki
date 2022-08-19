import { Model } from 'objection'
import { BaseModel } from '../shared/baseModel'
import { Grant } from '../grant/model'

// https://datatracker.ietf.org/doc/html/draft-ietf-gnap-core-protocol#section-3.2.1
export class AccessToken extends BaseModel {
  public static get tableName(): string {
    return 'accessTokens'
  }

  static relationMappings = {
    grant: {
      relation: Model.HasOneRelation,
      modelClass: Grant,
      join: {
        from: 'accessTokens.grantId',
        to: 'grants.id'
      }
    }
  }

  public value!: string
  public managementId!: string
  public grantId!: string
  public expiresIn!: number
}
