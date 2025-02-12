import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../app'
import { TenantSetting } from '../tenants/settings/model'
import { CreateOptions, KeyValuePair } from '../tenants/settings/service'
import { faker } from '@faker-js/faker'
import { isTenantSettingError } from '../tenants/settings/errors'

export function randomSetting(): KeyValuePair {
  return {
    key: faker.string.alphanumeric({
      length: { min: 10, max: 20 }
    }),
    value: faker.string.uuid()
  }
}

export async function createTenantSettings(
  deps: IocContract<AppServices>,
  options: CreateOptions
): Promise<TenantSetting> {
  const tenantSettingService = await deps.use('tenantSettingService')
  const tenantSettingOrError = await tenantSettingService.create(options)
  if (isTenantSettingError(tenantSettingOrError)) {
    throw tenantSettingOrError
  }
  return tenantSettingOrError[0]
}
