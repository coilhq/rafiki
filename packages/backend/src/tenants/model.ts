import { BaseModel } from '../shared/baseModel'
import { Model, Pojo } from 'objection'
import { TenantSetting } from './settings/model'

export class Tenant extends BaseModel {
  public static get tableName(): string {
    return 'tenants'
  }

  public static get relationMappings() {
    return {
      settings: {
        relation: Model.HasManyRelation,
        modelClass: TenantSetting,
        join: {
          from: 'tenants.id',
          to: 'tenantSettings.tenantId'
        }
      }
    }
  }

  public email!: string
  public apiSecret!: string
  public idpConsentUrl!: string
  public idpSecret!: string
  public publicName?: string
  public settings?: TenantSetting[]

  public deletedAt?: Date

  $formatJson(json: Pojo): Pojo {
    json = super.$formatJson(json)
    return {
      ...json,
      deletedAt: json.deletedAt.toISOString()
    }
  }
}
