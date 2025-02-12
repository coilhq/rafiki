import { faker } from '@faker-js/faker'
import jestOpenAPI from 'jest-openapi'

import { Amount, AmountJSON, parseAmount, serializeAmount } from '../../amount'
import { WalletAddress } from '../../wallet_address/model'
import { getRouteTests, setup } from '../../wallet_address/model.test'
import { createTestApp, TestContainer } from '../../../tests/app'
import { Config, IAppConfig } from '../../../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../..'
import { AppServices, CreateContext, CompleteContext } from '../../../app'
import { truncateTables } from '../../../tests/tableManager'
import { IncomingPayment, IncomingPaymentState } from './model'
import {
  IncomingPaymentRoutes,
  CreateBody,
  ReadContextWithAuthenticatedStatus
} from './routes'
import { createAsset } from '../../../tests/asset'
import { createIncomingPayment } from '../../../tests/incomingPayment'
import { createWalletAddress } from '../../../tests/walletAddress'
import { Asset } from '../../../asset/model'
import { IncomingPaymentError, errorToHTTPCode, errorToMessage } from './errors'
import { IncomingPaymentService } from './service'
import { IncomingPaymentWithPaymentMethods as OpenPaymentsIncomingPaymentWithPaymentMethods } from '@interledger/open-payments'

describe('Incoming Payment Routes', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let config: IAppConfig
  let incomingPaymentRoutes: IncomingPaymentRoutes
  let incomingPaymentService: IncomingPaymentService
  let tenantId: string

  beforeAll(async (): Promise<void> => {
    config = Config
    deps = await initIocContainer(config)
    appContainer = await createTestApp(deps)
    const { resourceServerSpec } = await deps.use('openApi')
    jestOpenAPI(resourceServerSpec)
    tenantId = Config.operatorTenantId
  })

  let asset: Asset
  let walletAddress: WalletAddress
  let baseUrl: string
  let expiresAt: Date
  let incomingAmount: Amount
  let metadata: Record<string, unknown>

  beforeEach(async (): Promise<void> => {
    config = await deps.use('config')
    incomingPaymentRoutes = await deps.use('incomingPaymentRoutes')
    incomingPaymentService = await deps.use('incomingPaymentService')

    expiresAt = new Date(Date.now() + 30_000)
    asset = await createAsset(deps)
    walletAddress = await createWalletAddress(deps, {
      tenantId,
      assetId: asset.id
    })
    baseUrl = new URL(walletAddress.url).origin
    incomingAmount = {
      value: BigInt('123'),
      assetScale: asset.scale,
      assetCode: asset.code
    }
    metadata = {
      description: 'hello world',
      externalRef: '#123'
    }
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get/list', (): void => {
    getRouteTests({
      getWalletAddress: async () => walletAddress,
      createModel: async ({ client }) =>
        createIncomingPayment(deps, {
          walletAddressId: walletAddress.id,
          client,
          expiresAt,
          incomingAmount,
          metadata,
          tenantId
        }),
      get: (ctx) =>
        incomingPaymentRoutes.get(ctx as ReadContextWithAuthenticatedStatus),
      getBody: (incomingPayment, list) => {
        const response: Partial<OpenPaymentsIncomingPaymentWithPaymentMethods> =
          {
            id: incomingPayment.getUrl(walletAddress),
            walletAddress: walletAddress.url,
            completed: false,
            incomingAmount:
              incomingPayment.incomingAmount &&
              serializeAmount(incomingPayment.incomingAmount),
            expiresAt: incomingPayment.expiresAt.toISOString(),
            createdAt: incomingPayment.createdAt.toISOString(),
            updatedAt: incomingPayment.updatedAt.toISOString(),
            receivedAmount: serializeAmount(incomingPayment.receivedAmount),
            metadata: incomingPayment.metadata
          }

        if (!list) {
          response.methods = [
            {
              type: 'ilp',
              ilpAddress: expect.stringMatching(
                /^test\.rafiki\.[a-zA-Z0-9_-]{95}$/
              ),
              sharedSecret: expect.any(String)
            }
          ]
        }
        return response
      },
      list: (ctx) => incomingPaymentRoutes.list(ctx),
      urlPath: IncomingPayment.urlPath
    })
  })

  describe('get', (): void => {
    test.each([IncomingPaymentState.Completed, IncomingPaymentState.Expired])(
      'returns incoming payment with empty methods if payment state is %s',
      async (paymentState): Promise<void> => {
        const walletAddress = await createWalletAddress(deps, {
          tenantId
        })
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: walletAddress.id,
          tenantId
        })
        await incomingPayment.$query().update({ state: paymentState })

        const ctx = setup<ReadContextWithAuthenticatedStatus>({
          reqOpts: {
            headers: { Accept: 'application/json' },
            method: 'GET',
            url: `/incoming-payments/${incomingPayment.id}`
          },
          params: {
            id: incomingPayment.id
          },
          walletAddress
        })

        await expect(incomingPaymentRoutes.get(ctx)).resolves.toBeUndefined()

        expect(ctx.response).toSatisfyApiSpec()
        expect(ctx.body).toMatchObject({ methods: [] })
      }
    ),
      test('by tenantId', async () => {
        const walletAddress = await createWalletAddress(deps, {
          tenantId
        })
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: walletAddress.id,
          tenantId
        })

        const ctx = setup<ReadContextWithAuthenticatedStatus>({
          reqOpts: {
            headers: { Accept: 'application/json' },
            method: 'GET',
            url: `/incoming-payments/${incomingPayment.id}`
          },
          params: {
            id: incomingPayment.id,
            tenantId
          },
          walletAddress
        })

        await expect(incomingPaymentRoutes.get(ctx)).resolves.toBeUndefined()

        expect(ctx.response).toSatisfyApiSpec()
        expect(ctx.body).toMatchObject({
          methods: [
            {
              type: 'ilp',
              ilpAddress: expect.stringMatching(
                /^test\.rafiki\.[a-zA-Z0-9_-]{95}$/
              ),
              sharedSecret: expect.any(String)
            }
          ]
        })
      })
  })

  describe('create', (): void => {
    let amount: AmountJSON

    beforeEach((): void => {
      amount = {
        value: '2',
        assetCode: asset.code,
        assetScale: asset.scale
      }
    })

    test.each(Object.values(IncomingPaymentError))(
      'returns error on %s',
      async (error): Promise<void> => {
        const ctx = setup<CreateContext<CreateBody>>({
          reqOpts: { body: {} },
          walletAddress,
          params: {
            tenantId
          }
        })
        const createSpy = jest
          .spyOn(incomingPaymentService, 'create')
          .mockResolvedValueOnce(error)
        await expect(incomingPaymentRoutes.create(ctx)).rejects.toMatchObject({
          message: errorToMessage[error],
          status: errorToHTTPCode[error]
        })
        expect(createSpy).toHaveBeenCalledWith({
          walletAddressId: walletAddress.id,
          tenantId
        })
      }
    )

    test.each`
      client                                        | incomingAmount | expiresAt                                      | metadata
      ${faker.internet.url({ appendSlash: false })} | ${true}        | ${new Date(Date.now() + 30_000).toISOString()} | ${{ description: 'text', externalRef: '#123' }}
      ${undefined}                                  | ${false}       | ${undefined}                                   | ${undefined}
    `(
      'returns the incoming payment on success',
      async ({
        client,
        incomingAmount,
        metadata,
        expiresAt
      }): Promise<void> => {
        const ctx = setup<CreateContext<CreateBody>>({
          params: {
            tenantId
          },
          reqOpts: {
            body: {
              incomingAmount: incomingAmount ? amount : undefined,
              metadata,
              expiresAt
            },
            method: 'POST',
            url: `/incoming-payments`
          },
          walletAddress,
          client
        })
        const incomingPaymentService = await deps.use('incomingPaymentService')
        const createSpy = jest.spyOn(incomingPaymentService, 'create')
        await expect(incomingPaymentRoutes.create(ctx)).resolves.toBeUndefined()
        expect(createSpy).toHaveBeenCalledWith({
          walletAddressId: walletAddress.id,
          incomingAmount: incomingAmount ? parseAmount(amount) : undefined,
          metadata,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          client,
          tenantId
        })
        expect(ctx.response).toSatisfyApiSpec()
        const incomingPaymentId = (
          (ctx.response.body as Record<string, unknown>)['id'] as string
        )
          .split('/')
          .pop()

        expect(ctx.response.body).toEqual({
          id: `${baseUrl}/${tenantId}/incoming-payments/${incomingPaymentId}`,
          walletAddress: walletAddress.url,
          incomingAmount: incomingAmount ? amount : undefined,
          expiresAt: expiresAt || expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          receivedAmount: {
            value: '0',
            assetCode: asset.code,
            assetScale: asset.scale
          },
          metadata,
          completed: false,
          methods: [
            {
              type: 'ilp',
              ilpAddress: expect.stringMatching(
                /^test\.rafiki\.[a-zA-Z0-9_-]{95}$/
              ),
              sharedSecret: expect.any(String)
            }
          ]
        })
      }
    )
  })

  describe('complete', (): void => {
    let incomingPayment: IncomingPayment
    beforeEach(async (): Promise<void> => {
      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: walletAddress.id,
        expiresAt,
        incomingAmount,
        metadata,
        tenantId
      })
    })
    test('returns 200 with an updated open payments incoming payment', async (): Promise<void> => {
      const ctx = setup<CompleteContext>({
        reqOpts: {
          headers: { Accept: 'application/json' },
          method: 'POST',
          url: `/incoming-payments/${incomingPayment.id}/complete`
        },
        params: {
          id: incomingPayment.id,
          tenantId
        },
        walletAddress
      })
      ctx.walletAddress = walletAddress
      await expect(incomingPaymentRoutes.complete(ctx)).resolves.toBeUndefined()
      expect(ctx.response).toSatisfyApiSpec()
      expect(ctx.body).toEqual({
        id: incomingPayment.getUrl(walletAddress),
        walletAddress: walletAddress.url,
        incomingAmount: {
          value: '123',
          assetCode: asset.code,
          assetScale: asset.scale
        },
        expiresAt: expiresAt.toISOString(),
        createdAt: incomingPayment.createdAt.toISOString(),
        updatedAt: expect.any(String),
        receivedAmount: {
          value: '0',
          assetCode: asset.code,
          assetScale: asset.scale
        },
        metadata,
        completed: true
      })
    })
  })
  describe('get unauthenticated incoming payment', (): void => {
    test('Can get incoming payment with public fields', async (): Promise<void> => {
      const incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: walletAddress.id,
        expiresAt,
        incomingAmount,
        metadata,
        tenantId
      })

      const ctx = setup<ReadContextWithAuthenticatedStatus>({
        reqOpts: {
          headers: { Accept: 'application/json' },
          method: 'GET',
          url: `/incoming-payments/${incomingPayment.id}`
        },
        params: {
          id: incomingPayment.id,
          tenantId
        },
        walletAddress
      })
      ctx.authenticated = false

      await expect(incomingPaymentRoutes.get(ctx)).resolves.toBeUndefined()
      expect(ctx.response).toSatisfyApiSpec()
      expect(ctx.body).toEqual({
        authServer: config.authServerGrantUrl + '/' + config.operatorTenantId, // TODO: replace with incoming payment tenant id
        receivedAmount: {
          value: '0',
          assetCode: asset.code,
          assetScale: asset.scale
        }
      })
    })
  })
})
