import assert from 'assert'
import { faker } from '@faker-js/faker'
import { IocContract } from '@adonisjs/fold'
import nock from 'nock'
import { Knex } from 'knex'
import { AppServices } from '../app'
import { initIocContainer } from '..'
import { createTestApp, TestContainer } from '../tests/app'
import { TenantService } from './service'
import { Config, IAppConfig } from '../config/app'
import { truncateTables } from '../tests/tableManager'
import { Tenant } from './model'
import { getPageTests } from '../shared/baseModel.test'
import { Pagination, SortOrder } from '../shared/baseModel'
import { createTenant } from '../tests/tenant'
import { CacheDataStore } from '../middleware/cache/data-stores'
import { AuthServiceClient } from '../auth-service-client/client'
import { withConfigOverride } from '../tests/helpers'
import { TenantSetting } from './settings/model'
import { TenantSettingService } from './settings/service'

describe('Tenant Service', (): void => {
  let deps: IocContract<AppServices>
  let config: IAppConfig
  let appContainer: TestContainer
  let tenantService: TenantService
  let knex: Knex
  const dbSchema = 'tenant_service_test_schema'
  let authServiceClient: AuthServiceClient
  let tenantSettingsService: TenantSettingService;

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({
      ...Config,
      dbSchema
    })
    appContainer = await createTestApp(deps)
    tenantService = await deps.use('tenantService')
    knex = await deps.use('knex')
    config = await deps.use('config')
    authServiceClient = await deps.use('authServiceClient')
    tenantSettingsService = await deps.use('tenantSettingService')
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(knex, true, dbSchema)
  })

  afterAll(async (): Promise<void> => {
    nock.cleanAll()
    await appContainer.shutdown()
  })

  describe('Tenant pagination', (): void => {
    describe('getPage', (): void => {
      getPageTests({
        createModel: () => createTenant(deps),
        getPage: (pagination?: Pagination, sortOrder?: SortOrder) =>
          tenantService.getPage(pagination, sortOrder)
      })
    })
  })

  describe('get', (): void => {
    test('can get a tenant', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        publicName: 'test tenant',
        email: faker.internet.email(),
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      const createdTenant =
        await Tenant.query(knex).insertAndFetch(createOptions)

      const tenant = await tenantService.get(createdTenant.id)
      assert.ok(tenant)
      expect(tenant).toEqual(createdTenant)
    })

    test('returns undefined if tenant is deleted', async (): Promise<void> => {
      const dbTenant = await Tenant.query(knex).insertAndFetch({
        apiSecret: 'test-secret',
        email: faker.internet.email(),
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret',
        deletedAt: new Date()
      })

      const tenant = await tenantService.get(dbTenant.id)
      expect(tenant).toBeUndefined()
    })

    test('returns tenant settings', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        publicName: 'test tenant',
        email: faker.internet.email(),
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)

      const tenant = await tenantService.create(createOptions)
      
      const tenantResponseData = await tenantService.get(tenant.id)
      expect(tenantResponseData?.settings?.length).toBeGreaterThan(0)
      expect(tenantResponseData?.settings).toEqual([
        expect.objectContaining({
          tenantId: tenant.id,
          key: 'WEBHOOK_TIMEOUT',
          value: '2000'
        }),
        expect.objectContaining({
          tenantId: tenant.id,
          key: 'WEBHOOK_MAX_RETRY',
          value: '10'
        }),
      ])
    })
  })

  describe('create', (): void => {
    test('can create a tenant', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        publicName: 'test tenant',
        email: faker.internet.email(),
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      const spy = jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)

      const tenant = await tenantService.create(createOptions)

      expect(tenant).toEqual(expect.objectContaining(createOptions))

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: tenant.id,
          idpSecret: createOptions.idpSecret,
          idpConsentUrl: createOptions.idpConsentUrl
        })
      )

      const tenantSettings = await TenantSetting.query().where(
        'tenantId',
        tenant.id
      )
      expect(tenantSettings.length).toBeGreaterThan(0)
    })
    
    test('should have default settings', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        publicName: 'test tenant',
        email: faker.internet.email(),
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)

      const tenant = await tenantService.create(createOptions)

      expect(tenant.settings).toEqual([
        expect.objectContaining({
          tenantId: tenant.id,
          key: 'WEBHOOK_TIMEOUT',
          value: '2000'
        }),
        expect.objectContaining({
          tenantId: tenant.id,
          key: 'WEBHOOK_MAX_RETRY',
          value: '10'
        })
      ])
    })

    test('tenant creation rolls back if auth tenant create fails', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        publicName: 'test tenant',
        email: faker.internet.email(),
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      const spy = jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(() => {
          throw new Error()
        })

      expect.assertions(3)
      let tenant
      try {
        tenant = await tenantService.create(createOptions)
      } catch (err) {
        expect(tenant).toBeUndefined()

        const tenants = await Tenant.query()
        expect(tenants.length).toEqual(0)

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            idpConsentUrl: createOptions.idpConsentUrl,
            idpSecret: createOptions.idpSecret
          })
        )
      }
    })
  })

  describe('update', (): void => {
    test('can update a tenant', async (): Promise<void> => {
      const originalTenantInfo = {
        apiSecret: 'test-api-secret',
        email: faker.internet.url(),
        publicName: 'test name',
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)

      const tenant = await tenantService.create(originalTenantInfo)

      const updatedTenantInfo = {
        id: tenant.id,
        apiSecret: 'test-api-secret-two',
        email: faker.internet.url(),
        publicName: 'second test name',
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret-two'
      }

      const spy = jest
        .spyOn(authServiceClient.tenant, 'update')
        .mockImplementationOnce(async () => undefined)
      const updatedTenant = await tenantService.update(updatedTenantInfo)

      expect(updatedTenant).toEqual(expect.objectContaining(updatedTenantInfo))
      expect(spy).toHaveBeenCalledWith(tenant.id, {
        idpConsentUrl: updatedTenantInfo.idpConsentUrl,
        idpSecret: updatedTenantInfo.idpSecret
      })
    })

    test('rolls back tenant if auth tenant update fails', async (): Promise<void> => {
      const originalTenantInfo = {
        apiSecret: 'test-api-secret',
        email: faker.internet.url(),
        publicName: 'test name',
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)

      const tenant = await tenantService.create(originalTenantInfo)
      const updatedTenantInfo = {
        id: tenant.id,
        apiSecret: 'test-api-secret-two',
        email: faker.internet.url(),
        publicName: 'second test name',
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret-two'
      }

      const spy = jest
        .spyOn(authServiceClient.tenant, 'update')
        .mockImplementationOnce(async () => {
          throw new Error()
        })

      let updatedTenant
      expect.assertions(3)
      try {
        updatedTenant = await tenantService.update(updatedTenantInfo)
      } catch (err) {
        expect(updatedTenant).toBeUndefined()
        const dbTenant = await Tenant.query().findById(tenant.id)
        assert.ok(dbTenant)
        expect(dbTenant).toEqual(expect.objectContaining(originalTenantInfo))
        expect(spy).toHaveBeenCalledWith(
          tenant.id,
          expect.objectContaining({
            idpConsentUrl: updatedTenantInfo.idpConsentUrl,
            idpSecret: updatedTenantInfo.idpSecret
          })
        )
      }
    })

    test('Cannot update deleted tenant', async (): Promise<void> => {
      const originalSecret = 'test-secret'
      const dbTenant = await Tenant.query(knex).insertAndFetch({
        email: faker.internet.url(),
        apiSecret: originalSecret,
        idpSecret: 'test-idp-secret',
        idpConsentUrl: faker.internet.url(),
        deletedAt: new Date()
      })

      const spy = jest.spyOn(authServiceClient.tenant, 'update')
      try {
        await tenantService.update({
          id: dbTenant.id,
          apiSecret: 'test-secret-2'
        })
      } catch (err) {
        const dbTenantAfterUpdate = await Tenant.query(knex).findById(
          dbTenant.id
        )

        assert.ok(dbTenantAfterUpdate)
        expect(dbTenantAfterUpdate.apiSecret).toEqual(originalSecret)
        expect(spy).toHaveBeenCalledTimes(0)
      }
    })
  })

  describe('Delete Tenant', (): void => {
    test('Can delete tenant', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        email: faker.internet.url(),
        publicName: 'test name',
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)
      const tenant = await tenantService.create(createOptions)

      const spy = jest
        .spyOn(authServiceClient.tenant, 'delete')
        .mockImplementationOnce(async () => undefined)
      await tenantService.delete(tenant.id)

      const dbTenant = await Tenant.query().findById(tenant.id)
      assert.ok(dbTenant?.deletedAt)
      expect(dbTenant.deletedAt.getTime()).toBeLessThanOrEqual(
        new Date(Date.now()).getTime()
      )
      expect(spy).toHaveBeenCalledWith(tenant.id, dbTenant.deletedAt)

      const settings = await tenantSettingsService.get({ tenantId: tenant.id }) as TenantSetting[]
      expect(settings.length).toBe(0)
    })

    test('Reverts deletion if auth tenant delete fails', async (): Promise<void> => {
      const createOptions = {
        apiSecret: 'test-api-secret',
        email: faker.internet.url(),
        publicName: 'test name',
        idpConsentUrl: faker.internet.url(),
        idpSecret: 'test-idp-secret'
      }

      jest
        .spyOn(authServiceClient.tenant, 'create')
        .mockImplementationOnce(async () => undefined)
      const tenant = await tenantService.create(createOptions)

      const spy = jest
        .spyOn(authServiceClient.tenant, 'delete')
        .mockImplementationOnce(async () => {
          throw new Error()
        })

      expect.assertions(3)
      try {
        await tenantService.delete(tenant.id)
      } catch (err) {
        const dbTenant = await Tenant.query().findById(tenant.id)
        assert.ok(dbTenant)
        expect(dbTenant.id).toEqual(tenant.id)
        expect(dbTenant.deletedAt).toBeNull()
        expect(spy).toHaveBeenCalledWith(tenant.id, expect.any(Date))
      }
    })
  })

  describe('Tenant Service using cache', (): void => {
    let tenantCache: CacheDataStore<Tenant>
    let authServiceClient: AuthServiceClient

    beforeAll(async (): Promise<void> => {
      tenantCache = await deps.use('tenantCache')
      authServiceClient = await deps.use('authServiceClient')
    })

    describe('create, update, and retrieve tenant using cache', (): void => {
      test(
        'Tenant can be created, updated, and fetched',
        withConfigOverride(
          () => config,
          { localCacheDuration: 5_000 },
          async (): Promise<void> => {
            const createOptions = {
              email: faker.internet.email(),
              publicName: faker.company.name(),
              apiSecret: 'test-api-secret',
              idpConsentUrl: faker.internet.url(),
              idpSecret: 'test-idp-secret'
            }

            jest
              .spyOn(authServiceClient.tenant, 'create')
              .mockImplementation(async () => undefined)

            const spyCacheSet = jest.spyOn(tenantCache, 'set')
            const tenant = await tenantService.create(createOptions)
            expect(tenant).toMatchObject({
              ...createOptions,
              id: tenant.id
            })

            // Ensure that the cache was set for create
            expect(spyCacheSet).toHaveBeenCalledTimes(1)

            const spyCacheGet = jest.spyOn(tenantCache, 'get')
            await expect(tenantService.get(tenant.id)).resolves.toEqual(tenant)

            expect(spyCacheGet).toHaveBeenCalledTimes(1)
            expect(spyCacheGet).toHaveBeenCalledWith(tenant.id)

            const spyCacheUpdateSet = jest.spyOn(tenantCache, 'set')
            jest
              .spyOn(authServiceClient.tenant, 'update')
              .mockImplementation(async () => undefined)
            const updatedTenant = await tenantService.update({
              id: tenant.id,
              apiSecret: 'test-api-secret-2'
            })

            await expect(tenantService.get(tenant.id)).resolves.toEqual(
              updatedTenant
            )

            // Ensure that cache was set for update
            expect(spyCacheUpdateSet).toHaveBeenCalledTimes(2)
            expect(spyCacheUpdateSet).toHaveBeenCalledWith(
              tenant.id,
              updatedTenant
            )

            const spyCacheDelete = jest.spyOn(tenantCache, 'delete')
            jest
              .spyOn(authServiceClient.tenant, 'delete')
              .mockImplementation(async () => undefined)
            await tenantService.delete(tenant.id)

            await expect(tenantService.get(tenant.id)).resolves.toBeUndefined()

            // Ensure that cache was set for deletion
            expect(spyCacheDelete).toHaveBeenCalledTimes(1)
            expect(spyCacheDelete).toHaveBeenCalledWith(tenant.id)
          }
        )
      )
    })
  })
})
