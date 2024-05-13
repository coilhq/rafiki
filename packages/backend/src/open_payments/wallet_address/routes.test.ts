import jestOpenAPI from 'jest-openapi'
import { IocContract } from '@adonisjs/fold'
import { faker } from '@faker-js/faker'
import { initIocContainer } from '../../'
import { AppServices, WalletAddressUrlContext } from '../../app'
import { Config, IAppConfig } from '../../config/app'
import { createTestApp, TestContainer } from '../../tests/app'
import { createContext } from '../../tests/context'
import { createWalletAddress } from '../../tests/walletAddress'
import { truncateTables } from '../../tests/tableManager'
import { WalletAddressRoutes } from './routes'
import assert from 'assert'
import { OpenPaymentsServerRouteError } from '../route-errors'
import { WalletAddressService } from './service'

describe('Wallet Address Routes', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let config: IAppConfig
  let walletAddressRoutes: WalletAddressRoutes
  let walletAddressService: WalletAddressService

  beforeAll(async (): Promise<void> => {
    config = Config
    config.authServerGrantUrl = 'https://auth.wallet.example/authorize'
    deps = await initIocContainer(config)
    appContainer = await createTestApp(deps)
    const { walletAddressServerSpec } = await deps.use('openApi')
    jestOpenAPI(walletAddressServerSpec)
    config = await deps.use('config')
    walletAddressRoutes = await deps.use('walletAddressRoutes')
    walletAddressService = await deps.use('walletAddressService')
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get', (): void => {
    test('throws 404 error for nonexistent wallet address', async (): Promise<void> => {
      const ctx = createContext<WalletAddressUrlContext>({
        headers: { Accept: 'application/json' }
      })
      jest
        .spyOn(walletAddressService, 'getOrPollByUrl')
        .mockResolvedValueOnce(undefined)

      expect.assertions(2)
      try {
        await walletAddressRoutes.get(ctx)
      } catch (err) {
        assert(err instanceof OpenPaymentsServerRouteError)
        expect(err.status).toBe(404)
        expect(err.message).toBe('Could not get wallet address')
      }
    })

    test('throws 404 error for inactive wallet address', async (): Promise<void> => {
      const walletAddress = await createWalletAddress(deps, {
        publicName: faker.person.firstName()
      })

      await walletAddress.$query().patch({ deactivatedAt: new Date() })

      const ctx = createContext<WalletAddressUrlContext>({
        headers: { Accept: 'application/json' }
      })
      ctx.walletAddressUrl = walletAddress.url

      const getOrPollByUrlSpy = jest.spyOn(
        walletAddressService,
        'getOrPollByUrl'
      )

      expect.assertions(3)
      try {
        await walletAddressRoutes.get(ctx)
      } catch (err) {
        assert(err instanceof OpenPaymentsServerRouteError)
        expect(err.status).toBe(404)
        expect(err.message).toBe('Could not get wallet address')
        await expect(getOrPollByUrlSpy.mock.results[0].value).resolves.toEqual(
          walletAddress
        )
      }
    })

    test('returns 404 when fetching wallet address of instance itself', async (): Promise<void> => {
      const ctx = createContext<WalletAddressUrlContext>({
        headers: { Accept: 'application/json' }
      })

      ctx.walletAddressUrl = config.walletAddressUrl

      expect.assertions(2)
      try {
        await walletAddressRoutes.get(ctx)
      } catch (err) {
        assert(err instanceof OpenPaymentsServerRouteError)
        expect(err.status).toBe(404)
        expect(err.message).toBe('Could not get wallet address')
      }
    })

    test('returns wallet address', async (): Promise<void> => {
      const walletAddress = await createWalletAddress(deps, {
        publicName: faker.person.firstName()
      })

      const ctx = createContext<WalletAddressUrlContext>({
        headers: { Accept: 'application/json' },
        url: '/'
      })
      ctx.walletAddressUrl = walletAddress.url
      await expect(walletAddressRoutes.get(ctx)).resolves.toBeUndefined()
      expect(ctx.response).toSatisfyApiSpec()
      expect(ctx.body).toEqual({
        id: walletAddress.url,
        publicName: walletAddress.publicName,
        assetCode: walletAddress.asset.code,
        assetScale: walletAddress.asset.scale,
        authServer: config.authServerGrantUrl,
        resourceServer: config.openPaymentsUrl
      })
    })
  })
})
