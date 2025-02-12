import { faker } from '@faker-js/faker'
import jestOpenAPI from 'jest-openapi'
import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'
import assert from 'assert'
import { createTestApp, TestContainer } from '../../../tests/app'
import { Config, IAppConfig } from '../../../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../..'
import { AppServices, CreateContext } from '../../../app'
import { truncateTables } from '../../../tests/tableManager'
import { createAsset } from '../../../tests/asset'
import {
  CreateFromIncomingPayment,
  CreateFromQuote,
  CreateOutgoingPaymentOptions,
  OutgoingPaymentService,
  BaseOptions as CreateOutgoingPaymentBaseOptions
} from './service'
import { errorToHTTPCode, errorToMessage, OutgoingPaymentError } from './errors'
import { OutgoingPayment, OutgoingPaymentState } from './model'
import { OutgoingPaymentRoutes, CreateBody } from './routes'
import { serializeAmount } from '../../amount'
import { Grant } from '../../auth/middleware'
import { WalletAddress } from '../../wallet_address/model'
import {
  getRouteTests,
  setup as setupContext
} from '../../wallet_address/model.test'
import { createOutgoingPayment } from '../../../tests/outgoingPayment'
import { createWalletAddress } from '../../../tests/walletAddress'
import { UnionOmit } from '../../../shared/utils'
import { OpenPaymentsServerRouteError } from '../../route-errors'

describe('Outgoing Payment Routes', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let knex: Knex
  let config: IAppConfig
  let outgoingPaymentRoutes: OutgoingPaymentRoutes
  let outgoingPaymentService: OutgoingPaymentService
  let walletAddress: WalletAddress
  let baseUrl: string
  let tenantId: string

  const receivingWalletAddress = `https://wallet.example/${uuid()}`

  const createPayment = async (options?: {
    client?: string
    grant?: Grant
    metadata?: Record<string, unknown>
  }): Promise<OutgoingPayment> => {
    return await createOutgoingPayment(deps, {
      ...options,
      tenantId: Config.operatorTenantId,
      walletAddressId: walletAddress.id,
      method: 'ilp',
      receiver: `${receivingWalletAddress}/incoming-payments/${uuid()}`,
      debitAmount: {
        value: BigInt(56),
        assetCode: walletAddress.asset.code,
        assetScale: walletAddress.asset.scale
      },
      validDestination: false
    })
  }

  beforeAll(async (): Promise<void> => {
    config = Config
    deps = await initIocContainer(config)
    appContainer = await createTestApp(deps)
    knex = appContainer.knex
    config = await deps.use('config')
    outgoingPaymentRoutes = await deps.use('outgoingPaymentRoutes')
    outgoingPaymentService = await deps.use('outgoingPaymentService')
    const { resourceServerSpec } = await deps.use('openApi')
    jestOpenAPI(resourceServerSpec)
  })

  beforeEach(async (): Promise<void> => {
    const asset = await createAsset(deps)
    tenantId = Config.operatorTenantId
    walletAddress = await createWalletAddress(deps, {
      tenantId,
      assetId: asset.id
    })
    baseUrl = new URL(walletAddress.url).origin
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe.each`
    failed   | description
    ${false} | ${''}
    ${true}  | ${' failed'}
  `('get/list$description outgoing payment', ({ failed }): void => {
    getRouteTests({
      getWalletAddress: async () => walletAddress,
      createModel: async ({ client }) => {
        const outgoingPayment = await createPayment({
          client,
          metadata: {
            description: 'rent',
            externalRef: '202201'
          }
        })
        if (failed) {
          await outgoingPayment
            .$query(knex)
            .patch({ state: OutgoingPaymentState.Failed })
        }
        return outgoingPayment
      },
      get: (ctx) => outgoingPaymentRoutes.get(ctx),
      getBody: (outgoingPayment) => {
        return {
          id: `${baseUrl}/${tenantId}/outgoing-payments/${outgoingPayment.id}`,
          walletAddress: walletAddress.url,
          receiver: outgoingPayment.receiver,
          quoteId: outgoingPayment.quote.getUrl(walletAddress),
          debitAmount: serializeAmount(outgoingPayment.debitAmount),
          sentAmount: serializeAmount(outgoingPayment.sentAmount),
          receiveAmount: serializeAmount(outgoingPayment.receiveAmount),
          metadata: outgoingPayment.metadata,
          failed,
          createdAt: outgoingPayment.createdAt.toISOString(),
          updatedAt: outgoingPayment.updatedAt.toISOString()
        }
      },
      list: (ctx) => outgoingPaymentRoutes.list(ctx),
      urlPath: OutgoingPayment.urlPath
    })
  })

  type SetupContextOptions = UnionOmit<
    CreateOutgoingPaymentOptions,
    'walletAddressId' | 'tenantId'
  >

  describe('create', (): void => {
    const setup = (options: SetupContextOptions): CreateContext<CreateBody> =>
      setupContext<CreateContext<CreateBody>>({
        reqOpts: {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          method: 'POST',
          url: `/outgoing-payments`,
          body: options
        },
        params: {
          tenantId
        },
        walletAddress,
        client: options.client,
        grant: options.grant
      })

    enum CreateFrom {
      Quote = 'quote',
      IncomingPayment = 'incomingPayment'
    }

    describe.each`
      createFrom                    | grant             | client                                        | description
      ${CreateFrom.Quote}           | ${{ id: uuid() }} | ${faker.internet.url({ appendSlash: false })} | ${'grant'}
      ${CreateFrom.Quote}           | ${undefined}      | ${undefined}                                  | ${'no grant'}
      ${CreateFrom.IncomingPayment} | ${{ id: uuid() }} | ${faker.internet.url({ appendSlash: false })} | ${'grant'}
      ${CreateFrom.IncomingPayment} | ${undefined}      | ${undefined}                                  | ${'no grant'}
    `(
      'create from $createFrom with $description',
      ({ grant, client, createFrom }): void => {
        test('returns the outgoing payment on success (metadata)', async (): Promise<void> => {
          const metadata = {
            description: 'rent',
            externalRef: '202201'
          }
          const payment = await createPayment({
            client,
            grant,
            metadata
          })
          let options: Omit<
            CreateOutgoingPaymentBaseOptions,
            'walletAddressId'
          > = {
            tenantId,
            client,
            grant,
            metadata
          }
          if (createFrom === CreateFrom.Quote) {
            options = {
              ...options,
              quoteId: `${baseUrl}/${payment.quote.tenantId}/quotes/${payment.quote.id}`
            } as CreateFromQuote
          } else {
            assert(createFrom === CreateFrom.IncomingPayment)
            options = {
              ...options,
              incomingPayment: faker.internet.url(),
              debitAmount: {
                value: BigInt(56),
                assetCode: walletAddress.asset.code,
                assetScale: walletAddress.asset.scale
              }
            } as CreateFromIncomingPayment
          }
          const ctx = setup(options as SetupContextOptions)
          const createSpy = jest
            .spyOn(outgoingPaymentService, 'create')
            .mockResolvedValueOnce(payment)
          await expect(
            outgoingPaymentRoutes.create(ctx)
          ).resolves.toBeUndefined()

          let expectedCreateOptions: CreateOutgoingPaymentBaseOptions = {
            tenantId,
            walletAddressId: walletAddress.id,
            metadata,
            client,
            grant
          }
          if (createFrom === CreateFrom.Quote) {
            expectedCreateOptions = {
              ...expectedCreateOptions,
              quoteId: payment.quote.id
            } as CreateFromQuote
          } else {
            assert(createFrom === CreateFrom.IncomingPayment)
            expectedCreateOptions = {
              ...expectedCreateOptions,
              incomingPayment: (options as CreateFromIncomingPayment)
                .incomingPayment,
              debitAmount: (options as CreateFromIncomingPayment).debitAmount
            } as CreateFromIncomingPayment
          }

          expect(createSpy).toHaveBeenCalledWith(expectedCreateOptions)
          expect(ctx.response).toSatisfyApiSpec()
          const outgoingPaymentId = (
            (ctx.response.body as Record<string, unknown>)['id'] as string
          )
            .split('/')
            .pop()
          expect(ctx.response.body).toEqual({
            id: `${baseUrl}/${tenantId}/outgoing-payments/${outgoingPaymentId}`,
            walletAddress: walletAddress.url,
            receiver: payment.receiver,
            quoteId:
              'quoteId' in options ? options.quoteId : expect.any(String),
            debitAmount: {
              ...payment.debitAmount,
              value: payment.debitAmount.value.toString()
            },
            receiveAmount: {
              ...payment.receiveAmount,
              value: payment.receiveAmount.value.toString()
            },
            metadata: options.metadata,
            sentAmount: {
              value: '0',
              assetCode: walletAddress.asset.code,
              assetScale: walletAddress.asset.scale
            },
            grantSpentDebitAmount: {
              value: '0',
              assetCode: walletAddress.asset.code,
              assetScale: walletAddress.asset.scale
            },
            grantSpentReceiveAmount: {
              value: '0',
              assetCode: payment.quote.receiveAmount.assetCode,
              assetScale: payment.quote.receiveAmount.assetScale
            },
            failed: false,
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          })
        })
      }
    )

    test.each(Object.values(OutgoingPaymentError).map((err) => [err]))(
      'returns error on %s',
      async (error): Promise<void> => {
        const quoteId = uuid()
        const tenantId = Config.operatorTenantId
        const ctx = setup({
          quoteId: `${baseUrl}/${tenantId}/quotes/${quoteId}`
        })
        const createSpy = jest
          .spyOn(outgoingPaymentService, 'create')
          .mockResolvedValueOnce(error)

        expect.assertions(3)

        try {
          await outgoingPaymentRoutes.create(ctx)
        } catch (err) {
          assert(err instanceof OpenPaymentsServerRouteError)
          expect(err.message).toBe(errorToMessage[error])
          expect(err.status).toBe(errorToHTTPCode[error])
        }

        expect(createSpy).toHaveBeenCalledWith({
          walletAddressId: walletAddress.id,
          quoteId,
          tenantId
        })
      }
    )
  })
})
