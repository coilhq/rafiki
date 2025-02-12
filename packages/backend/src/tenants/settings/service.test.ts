import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { initIocContainer } from '../..'
import { Config } from '../../config/app'
import { createTestApp, TestContainer } from '../../tests/app'
import nock from 'nock'
import { truncateTables } from '../../tests/tableManager'
import { Knex } from 'knex'
import { Tenant } from '../model'
import { TenantService } from '../service'
import { faker } from '@faker-js/faker'
import { getPageTests } from '../../shared/baseModel.test'
import { Pagination, SortOrder } from '../../shared/baseModel'
import { createTenantSettings, randomSetting } from '../../tests/tenantSettings'
import { TenantSetting } from './model'
import {
  CreateOptions,
  GetOptions,
  TenantSettingService,
  UpdateOptions
} from './service'
import { AuthServiceClient } from '../../auth-service-client/client'

describe('TenantSetting Service', (): void => {
  let knex: Knex
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let tenant: Tenant
  let tenantService: TenantService
  let tenantSettingService: TenantSettingService
  let authServiceClient: AuthServiceClient

  const dbSchema = 'tenant_settings_service_test_schema'

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({ ...Config, dbSchema })
    appContainer = await createTestApp(deps)

    knex = await deps.use('knex')
    tenantService = await deps.use('tenantService')
    tenantSettingService = await deps.use('tenantSettingService')
    authServiceClient = await deps.use('authServiceClient')
  })

  beforeEach(async (): Promise<void> => {
    jest
      .spyOn(authServiceClient.tenant, 'create')
      .mockResolvedValueOnce(undefined)

    tenant = await tenantService.create({
      apiSecret: faker.string.uuid(),
      email: faker.internet.email(),
      idpConsentUrl: faker.internet.url(),
      idpSecret: faker.string.uuid()
    })
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(knex, true, dbSchema)
  })

  afterAll(async (): Promise<void> => {
    nock.cleanAll()
    await appContainer.shutdown()
  })

  describe('create', () => {
    test('can create a tenant setting', async (): Promise<void> => {
      const createOptions: CreateOptions = {
        tenantId: tenant.id,
        setting: [randomSetting()]
      }

      const tenantSetting = await tenantSettingService.create(createOptions)

      expect(tenantSetting).toEqual([
        expect.objectContaining({
          tenantId: tenant.id,
          key: createOptions.setting[0].key,
          value: createOptions.setting[0].value
        })
      ])
    })
  })

  describe('get', () => {
    let tenantSetting: TenantSetting[]

    function createTenantSetting() {
      const options: CreateOptions = {
        tenantId: tenant.id,
        setting: [randomSetting()]
      }

      return tenantSettingService.create(options)
    }

    beforeEach(async (): Promise<void> => {
      await createTenantSetting()
      tenantSetting = (await tenantSettingService.get({
        tenantId: tenant.id
      })) as TenantSetting[]
    })

    afterEach(async (): Promise<void> => {
      return tenantSettingService.delete({
        tenantId: tenant.id
      })
    })

    test('should get tenant setting', async () => {
      const dbTenantSetting = await tenantSettingService.get({
        tenantId: tenant.id,
        key: tenantSetting[0].key
      })

      expect(dbTenantSetting).toEqual([tenantSetting[0]])
    })

    test('should get all tenant settings', async () => {
      const newTenantSetting = await createTenantSetting()
      const dbTenantSettings = await tenantSettingService.get({
        tenantId: tenant.id
      })

      const settings = tenantSetting.concat(newTenantSetting)

      expect(dbTenantSettings).toEqual(settings)
    })

    test('should not get deleted tenant', async () => {
      const options: GetOptions = {
        tenantId: tenant.id,
        key: tenantSetting[0].key
      }

      await tenantSettingService.delete(options)
      const dbTenantSetting = await tenantSettingService.get(options)

      expect(dbTenantSetting).toHaveLength(0)
    })
  })

  describe('update', () => {
    let updateOptions: UpdateOptions

    beforeEach(async () => {
      updateOptions = {
        tenantId: tenant.id,
        ...randomSetting()
      }

      await tenantSettingService.create({
        tenantId: updateOptions.tenantId,
        setting: [{ key: updateOptions.key, value: updateOptions.value }]
      })
    })

    test('can update own setting', async () => {
      const newValues = {
        ...updateOptions,
        value: 'test'
      }
      await tenantSettingService.update(newValues)

      const res = await tenantSettingService.get({
        tenantId: newValues.tenantId,
        key: newValues.key
      })

      expect(res).toEqual(
        expect.arrayContaining([expect.objectContaining(newValues)])
      )
    })
  })

  describe('delete', (): void => {
    test('can delete tenant setting key', async (): Promise<void> => {
      const createOptions: CreateOptions = {
        tenantId: tenant.id,
        setting: [randomSetting()]
      }

      const tenantSetting = await tenantSettingService.create(createOptions)
      await tenantSettingService.delete({
        tenantId: tenantSetting[0].tenantId,
        key: createOptions.setting[0].key
      })

      const dbTenantSetting = await TenantSetting.query().findById(
        tenantSetting[0].id
      )
      expect(dbTenantSetting?.deletedAt).toBeDefined()
      expect(dbTenantSetting?.deletedAt?.getTime()).toBeLessThanOrEqual(
        new Date(Date.now()).getTime()
      )
    })

    test('can delete all tenant settings', async (): Promise<void> => {
      for (let i = 0; i < 10; i++) {
        const createOptions: CreateOptions = {
          tenantId: tenant.id,
          setting: [randomSetting()]
        }

        await tenantSettingService.create(createOptions)
      }

      await tenantSettingService.delete({ tenantId: tenant.id })

      const dbTenantData = await TenantSetting.query().where({
        tenantId: tenant.id
      })

      expect(dbTenantData.filter((x) => !x.deletedAt)).toHaveLength(0)
    })
  })

  describe('pagination', (): void => {
    beforeEach(async () => {
      await tenantSettingService.delete({ tenantId: tenant.id })
    })
    describe('getPage', (): void => {
      getPageTests({
        createModel: () =>
          createTenantSettings(deps, {
            tenantId: tenant.id,
            setting: [randomSetting()]
          }) as Promise<TenantSetting>,
        getPage: (pagination?: Pagination, sortOrder?: SortOrder) =>
          tenantSettingService.getPage(tenant.id, pagination, sortOrder)
      })
    })
  })
})
