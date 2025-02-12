import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { createTestApp, TestContainer } from '../../tests/app'
import { initIocContainer } from '../..'
import { Config } from '../../config/app'
import { truncateTables } from '../../tests/tableManager'
import { createTenant } from '../../tests/tenant'
import { getPageTests } from './page.test'
import { createTenantSettings, randomSetting } from '../../tests/tenantSettings'
import {
  CreateTenantSettingsInput,
  CreateTenantSettingsMutationResponse,
  DeleteTenantSettingsInput,
  DeleteTenantSettingsMutationResponse
} from '../generated/graphql'
import {
  ApolloClient,
  NormalizedCacheObject,
  createHttpLink,
  ApolloLink,
  InMemoryCache,
  gql
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { Tenant } from '../../tenants/model'
import { TenantSettingService } from '../../tenants/settings/service'

function createTenantedApolloClient(
  appContainer: TestContainer,
  tenantId: string
): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({
    uri: `http://localhost:${appContainer.app.getAdminPort()}/graphql`,
    fetch
  })
  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        'tenant-id': tenantId
      }
    }
  })

  const link = ApolloLink.from([authLink, httpLink])

  return new ApolloClient({
    cache: new InMemoryCache({}),
    link: link,
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache'
      },
      mutate: {
        fetchPolicy: 'no-cache'
      },
      watchQuery: {
        fetchPolicy: 'no-cache'
      }
    }
  })
}

describe('Tenant Settings Resolvers', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({
      ...Config,
      dbSchema: 'tenant_settings_service_test_schema'
    })
    appContainer = await createTestApp(deps)

    const authServiceClient = await deps.use('authServiceClient')
    jest
      .spyOn(authServiceClient.tenant, 'create')
      .mockImplementation(async () => undefined)
    jest
      .spyOn(authServiceClient.tenant, 'update')
      .mockImplementation(async () => undefined)
    jest
      .spyOn(authServiceClient.tenant, 'delete')
      .mockImplementation(async () => undefined)
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex, true)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.apolloClient.stop()
    await appContainer.shutdown()
  })

  describe('Delete Tenant Settings', (): void => {
    let tenant: Tenant
    let client: ApolloClient<NormalizedCacheObject>
    let tenantSettingService: TenantSettingService
    let keys: string[]

    beforeEach(async () => {
      tenant = await createTenant(deps)
      client = createTenantedApolloClient(appContainer, tenant.id)

      keys = ['MY_KEY_1_TEST', 'MY_KEY_2_TEST']

      tenantSettingService = await deps.use('tenantSettingService')
      await tenantSettingService.create({
        tenantId: tenant.id,
        setting: keys.map((x) => ({
          key: x,
          value: x
        }))
      })
    })

    test('can delete all settings for a tenant', async (): Promise<void> => {
      const response = await client
        .mutate({
          mutation: gql`
            mutation DeleteTenantSettings($input: DeleteTenantSettingsInput!) {
              deleteTenantSettings(input: $input) {
                success
              }
            }
          `,
          variables: {
            input: {}
          }
        })
        .then((q): DeleteTenantSettingsMutationResponse => {
          if (q.data) {
            return q.data.deleteTenantSettings
          }
          throw new Error('Data was empty')
        })

      expect(response.success).toBeTruthy()

      const data = await tenantSettingService.get({
        tenantId: tenant.id
      })

      expect(data).toEqual([])
    })

    test('can delete tenant setting', async (): Promise<void> => {
      const workingKey = keys[0]
      const input: DeleteTenantSettingsInput = {
        key: workingKey
      }

      const response = await client
        .mutate({
          mutation: gql`
            mutation DeleteTenantSettings($input: DeleteTenantSettingsInput!) {
              deleteTenantSettings(input: $input) {
                success
              }
            }
          `,
          variables: { input }
        })
        .then((q): DeleteTenantSettingsMutationResponse => {
          if (q.data) {
            return q.data.deleteTenantSettings
          }
          throw new Error('Data was empty')
        })

      expect(response.success).toBeTruthy()

      const data = await tenantSettingService.get({
        tenantId: tenant.id,
        key: workingKey
      })

      expect(data).toEqual([])
    })
  })

  describe('Create Tenant Settings', (): void => {
    test('can create tenant setting', async (): Promise<void> => {
      const input: CreateTenantSettingsInput = {
        settings: [{ key: 'MY_KEY', value: 'MY_VALUE' }]
      }

      const tenant = await createTenant(deps)
      const client = createTenantedApolloClient(appContainer, tenant.id)
      const response = await client
        .mutate({
          mutation: gql`
            mutation CreateTenantSettings($input: CreateTenantSettingsInput!) {
              createTenantSettings(input: $input) {
                settings {
                  key
                  value
                }
              }
            }
          `,
          variables: { input }
        })
        .then((query): CreateTenantSettingsMutationResponse => {
          if (query.data) {
            return query.data.createTenantSettings
          }
          throw new Error('Data was empty')
        })

      expect(response.settings.length).toBeGreaterThan(0)
    })
  })

  describe('List tenant settings', (): void => {
    let tenantId: string
    beforeEach(async (): Promise<void> => {
      tenantId = (await createTenant(deps)).id
    })
    getPageTests({
      getClient: () => appContainer.apolloClient,
      createModel: () =>
        createTenantSettings(deps, {
          tenantId: tenantId,
          setting: [randomSetting()]
        }),
      pagedQuery: 'settings',
      parent: {
        query: 'tenants',
        getId: () => tenantId
      }
    })
  })
})
