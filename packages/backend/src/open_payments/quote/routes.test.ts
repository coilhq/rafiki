import assert from 'assert'
import { faker } from '@faker-js/faker'
import jestOpenAPI from 'jest-openapi'
import { v4 as uuid } from 'uuid'
import { IocContract } from '@adonisjs/fold'

import { createTestApp, TestContainer } from '../../tests/app'
import { Config, IAppConfig } from '../../config/app'
import { initIocContainer } from '../..'
import { AppServices, CreateContext } from '../../app'
import { truncateTables } from '../../tests/tableManager'
import { QuoteService } from './service'
import { Quote } from './model'
import { QuoteRoutes, CreateBody } from './routes'
import { Amount, serializeAmount } from '../amount'
import { WalletAddress } from '../wallet_address/model'
import {
  getRouteTests,
  setup as setupContext
} from '../wallet_address/model.test'
import { createAsset, randomAsset } from '../../tests/asset'
import { createWalletAddress } from '../../tests/walletAddress'
import { createQuote } from '../../tests/quote'

describe('Quote Routes', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let quoteService: QuoteService
  let config: IAppConfig
  let quoteRoutes: QuoteRoutes
  let walletAddress: WalletAddress
  let baseUrl: string
  let tenantId: string

  const receiver = `https://wallet2.example/incoming-payments/${uuid()}`
  const asset = randomAsset()
  const debitAmount: Amount = {
    value: BigInt(123),
    assetCode: asset.code,
    assetScale: asset.scale
  }

  const createWalletAddressQuote = async ({
    tenantId,
    walletAddressId,
    client
  }: {
    tenantId: string
    walletAddressId: string
    client?: string
  }): Promise<Quote> => {
    return await createQuote(deps, {
      tenantId,
      walletAddressId,
      receiver,
      debitAmount: {
        value: BigInt(56),
        assetCode: asset.code,
        assetScale: asset.scale
      },
      method: 'ilp',
      client,
      validDestination: false
    })
  }

  beforeAll(async (): Promise<void> => {
    config = Config
    deps = await initIocContainer(config)
    appContainer = await createTestApp(deps)
    config = await deps.use('config')
    quoteRoutes = await deps.use('quoteRoutes')
    quoteService = await deps.use('quoteService')
    const { resourceServerSpec } = await deps.use('openApi')
    jestOpenAPI(resourceServerSpec)
  })

  beforeEach(async (): Promise<void> => {
    tenantId = Config.operatorTenantId
    const { id: assetId } = await createAsset(deps, {
      code: debitAmount.assetCode,
      scale: debitAmount.assetScale
    })
    walletAddress = await createWalletAddress(deps, {
      tenantId,
      assetId
    })
    baseUrl = new URL(walletAddress.url).origin
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get', (): void => {
    getRouteTests({
      getWalletAddress: async () => walletAddress,
      createModel: async ({ client }) =>
        createWalletAddressQuote({
          tenantId,
          walletAddressId: walletAddress.id,
          client
        }),
      get: (ctx) => quoteRoutes.get(ctx),
      getBody: (quote) => {
        return {
          id: `${baseUrl}/${quote.tenantId}/quotes/${quote.id}`,
          walletAddress: walletAddress.url,
          receiver: quote.receiver,
          debitAmount: serializeAmount(quote.debitAmount),
          receiveAmount: serializeAmount(quote.receiveAmount),
          createdAt: quote.createdAt.toISOString(),
          expiresAt: quote.expiresAt.toISOString(),
          method: quote.method
        }
      },
      urlPath: Quote.urlPath
    })
  })

  describe('create', (): void => {
    let options: CreateBody

    const setup = ({
      client
    }: {
      client?: string
    }): CreateContext<CreateBody> =>
      setupContext<CreateContext<CreateBody>>({
        reqOpts: {
          body: options,
          method: 'POST',
          url: `/quotes`
        },
        params: {
          tenantId
        },
        walletAddress,
        client
      })

    test('returns error on invalid debitAmount asset', async (): Promise<void> => {
      options = {
        walletAddress: walletAddress.url,
        receiver,
        debitAmount: {
          ...debitAmount,
          value: debitAmount.value.toString(),
          assetScale: debitAmount.assetScale + 1
        },
        method: 'ilp'
      }
      const ctx = setup({})
      await expect(quoteRoutes.create(ctx)).rejects.toMatchObject({
        message: 'invalid amount',
        status: 400
      })
    })

    describe.each`
      client                                        | description
      ${faker.internet.url({ appendSlash: false })} | ${'client'}
      ${undefined}                                  | ${'no client'}
    `('returns the quote on success ($description)', ({ client }): void => {
      test.each`
        debitAmount  | receiveAmount | description
        ${'123'}     | ${undefined}  | ${'debitAmount'}
        ${undefined} | ${'56'}       | ${'receiveAmount'}
      `(
        '$description',
        async ({ debitAmount, receiveAmount }): Promise<void> => {
          options = {
            walletAddress: walletAddress.url,
            receiver,
            method: 'ilp'
          }
          if (debitAmount)
            options.debitAmount = {
              value: debitAmount,
              assetCode: asset.code,
              assetScale: asset.scale
            }
          if (receiveAmount)
            options.receiveAmount = {
              value: receiveAmount,
              assetCode: asset.code,
              assetScale: asset.scale
            }
          const ctx = setup({ client })
          let quote: Quote | undefined
          const quoteSpy = jest
            .spyOn(quoteService, 'create')
            .mockImplementationOnce(async (opts) => {
              quote = await createQuote(deps, {
                ...opts,
                validDestination: false,
                client
              })
              return quote
            })
          await expect(quoteRoutes.create(ctx)).resolves.toBeUndefined()
          expect(quoteSpy).toHaveBeenCalledWith({
            tenantId,
            walletAddressId: walletAddress.id,
            receiver,
            debitAmount: options.debitAmount && {
              ...options.debitAmount,
              value: BigInt(options.debitAmount.value)
            },
            receiveAmount: options.receiveAmount && {
              ...options.receiveAmount,
              value: BigInt(options.receiveAmount.value)
            },
            client,
            method: 'ilp'
          })
          expect(ctx.response).toSatisfyApiSpec()
          const quoteId = (
            (ctx.response.body as Record<string, unknown>)['id'] as string
          )
            .split('/')
            .pop()
          assert.ok(quote)
          expect(ctx.response.body).toEqual({
            id: `${baseUrl}/${tenantId}/quotes/${quoteId}`,
            walletAddress: walletAddress.url,
            receiver: quote.receiver,
            debitAmount: {
              ...quote.debitAmount,
              value: quote.debitAmount.value.toString()
            },
            receiveAmount: {
              ...quote.receiveAmount,
              value: quote.receiveAmount.value.toString()
            },
            createdAt: quote.createdAt.toISOString(),
            expiresAt: quote.expiresAt.toISOString(),
            method: 'ilp'
          })
        }
      )

      test('receiver.incomingAmount', async (): Promise<void> => {
        options = {
          walletAddress: walletAddress.url,
          receiver,
          method: 'ilp'
        }
        const ctx = setup({ client })
        let quote: Quote | undefined
        const quoteSpy = jest
          .spyOn(quoteService, 'create')
          .mockImplementationOnce(async (opts) => {
            quote = await createQuote(deps, {
              ...opts,
              validDestination: false,
              client
            })
            return quote
          })
        await expect(quoteRoutes.create(ctx)).resolves.toBeUndefined()
        expect(quoteSpy).toHaveBeenCalledWith({
          tenantId,
          walletAddressId: walletAddress.id,
          receiver,
          client,
          method: 'ilp'
        })
        expect(ctx.response).toSatisfyApiSpec()
        const quoteId = (
          (ctx.response.body as Record<string, unknown>)['id'] as string
        )
          .split('/')
          .pop()
        assert.ok(quote)
        expect(ctx.response.body).toEqual({
          id: `${baseUrl}/${tenantId}/quotes/${quoteId}`,
          walletAddress: walletAddress.url,
          receiver: options.receiver,
          debitAmount: {
            ...quote.debitAmount,
            value: quote.debitAmount.value.toString()
          },
          receiveAmount: {
            ...quote.receiveAmount,
            value: quote.receiveAmount.value.toString()
          },
          createdAt: quote.createdAt.toISOString(),
          expiresAt: quote.expiresAt.toISOString(),
          method: 'ilp'
        })
      })
    })
  })
})
