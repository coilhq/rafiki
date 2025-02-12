import { Pojo } from 'objection'
import { BaseModel } from '../../shared/baseModel'
import { KeyValuePair } from './service'

export const TenantSettingKeys = {
  EXCHANGE_RATES_URL: { name: 'EXCHANGE_RATES_URL' },
  WEBHOOK_URL: { name: 'WEBHOOK_URL' },
  WEBHOOK_TIMEOUT: { name: 'WEBHOOK_TIMEOUT', default: 2000 },
  WEBHOOK_MAX_RETRY: { name: 'WEBHOOK_MAX_RETRY', default: 10 }
}

export class TenantSetting extends BaseModel {
  public static get tableName(): string {
    return 'tenantSettings'
  }

  public key!: string
  public value!: string
  public tenantId!: string

  public deletedAt?: Date

  $formatJson(json: Pojo): Pojo {
    json = super.$formatJson(json)
    return {
      ...json,
      deletedAt: json.deletedAt.toISOString()
    }
  }

  static default(): KeyValuePair[] {
    return [
      {
        key: TenantSettingKeys.WEBHOOK_TIMEOUT.name,
        value: TenantSettingKeys.WEBHOOK_TIMEOUT.default.toString()
      },
      {
        key: TenantSettingKeys.WEBHOOK_MAX_RETRY.name,
        value: TenantSettingKeys.WEBHOOK_MAX_RETRY.default.toString()
      }
    ]
  }
}
