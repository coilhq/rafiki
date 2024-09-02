import { Model } from 'objection'
import { BaseModel, WeakModel } from '../shared/baseModel'
import { TenantEndpoint } from './endpoints/model'

export class Tenant extends BaseModel {
  public static get tableName(): string {
    return 'tenants'
  }

  public static get relationMappings() {
    return {
      endpoints: {
        relation: Model.HasManyRelation,
        modelClass: TenantEndpoint,
        join: {
          from: 'tenants.id',
          to: 'tenantEndpoints.tenantId'
        }
      }
    }
  }

  public kratosIdentityId!: string
  public deletedAt?: Date
  public endpoints!: TenantEndpoint[]
}
