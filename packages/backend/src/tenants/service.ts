import { Tenant } from './model'
import { BaseService } from '../shared/baseService'
import { TransactionOrKnex } from 'objection'
import { Pagination, SortOrder } from '../shared/baseModel'
import { CacheDataStore } from '../middleware/cache/data-stores'
import type { AuthServiceClient } from '../auth-service-client/client'
import { TenantSettingService } from './settings/service'
import { TenantSetting } from './settings/model'

export interface TenantService {
  get: (id: string) => Promise<Tenant | undefined>
  create: (options: CreateTenantOptions) => Promise<Tenant>
  update: (options: UpdateTenantOptions) => Promise<Tenant>
  delete: (id: string) => Promise<void>
  getPage: (pagination?: Pagination, sortOrder?: SortOrder) => Promise<Tenant[]>
}

export interface ServiceDependencies extends BaseService {
  knex: TransactionOrKnex
  tenantCache: CacheDataStore<Tenant>
  authServiceClient: AuthServiceClient
  tenantSettingService: TenantSettingService
}

export async function createTenantService(
  deps_: ServiceDependencies
): Promise<TenantService> {
  const deps: ServiceDependencies = {
    ...deps_,
    logger: deps_.logger.child({ service: 'TenantService' })
  }

  return {
    get: (id: string) => getTenant(deps, id),
    create: (options) => createTenant(deps, options),
    update: (options) => updateTenant(deps, options),
    delete: (id) => deleteTenant(deps, id),
    getPage: (pagination, sortOrder) =>
      getTenantPage(deps, pagination, sortOrder)
  }
}

async function getTenant(
  deps: ServiceDependencies,
  id: string
): Promise<Tenant | undefined> {
  const inMem = await deps.tenantCache.get(id)
  if (inMem) return inMem
  const tenant = await Tenant.query(deps.knex)
    .findById(id)
    .whereNull('deletedAt')
  if (tenant) await deps.tenantCache.set(tenant.id, tenant)

  return tenant
}

async function getTenantPage(
  deps: ServiceDependencies,
  pagination?: Pagination,
  sortOrder?: SortOrder
): Promise<Tenant[]> {
  return await Tenant.query(deps.knex).getPage(pagination, sortOrder)
}

interface CreateTenantOptions {
  email?: string
  apiSecret: string
  idpSecret?: string
  idpConsentUrl?: string
  publicName?: string
}

async function createTenant(
  deps: ServiceDependencies,
  options: CreateTenantOptions
): Promise<Tenant> {
  const trx = await deps.knex.transaction()
  try {
    const { email, apiSecret, publicName, idpSecret, idpConsentUrl } = options
    const tenant = await Tenant.query(trx).insertAndFetch({
      email,
      publicName,
      apiSecret,
      idpSecret,
      idpConsentUrl
    })

    await deps.authServiceClient.tenant.create({
      id: tenant.id,
      idpSecret,
      idpConsentUrl
    })

    const settings = await deps.tenantSettingService.create(
      {
        tenantId: tenant.id,
        setting: TenantSetting.default()
      },
      { trx }
    )

    await trx.commit()

    tenant.settings = settings
    await deps.tenantCache.set(tenant.id, tenant)
    return tenant
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

interface UpdateTenantOptions {
  id: string
  email?: string
  publicName?: string
  apiSecret?: string
  idpConsentUrl?: string
  idpSecret?: string
}

async function updateTenant(
  deps: ServiceDependencies,
  options: UpdateTenantOptions
): Promise<Tenant> {
  const trx = await deps.knex.transaction()

  try {
    const { id, apiSecret, email, publicName, idpConsentUrl, idpSecret } =
      options
    const tenant = await Tenant.query(trx)
      .patchAndFetchById(options.id, {
        email,
        publicName,
        apiSecret,
        idpConsentUrl,
        idpSecret
      })
      .whereNull('deletedAt')
      .throwIfNotFound()

    if (idpConsentUrl || idpSecret) {
      await deps.authServiceClient.tenant.update(id, {
        idpConsentUrl,
        idpSecret
      })
    }

    await trx.commit()
    await deps.tenantCache.set(tenant.id, tenant)
    return tenant
  } catch (err) {
    await trx.rollback()
    throw err
  }
}

async function deleteTenant(
  deps: ServiceDependencies,
  id: string
): Promise<void> {
  const trx = await deps.knex.transaction()

  await deps.tenantCache.delete(id)
  try {
    const deletedAt = new Date()

    await deps.tenantSettingService.delete(
      {
        tenantId: id
      },
      { trx }
    )
    await Tenant.query(trx).patchAndFetchById(id, {
      deletedAt
    })
    await deps.authServiceClient.tenant.delete(id, deletedAt)
    await trx.commit()
  } catch (err) {
    await trx.rollback()
    throw err
  }
}
