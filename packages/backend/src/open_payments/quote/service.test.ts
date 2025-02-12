import assert from 'assert'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

import { QuoteError, isQuoteError } from './errors'
import { QuoteService, CreateQuoteOptions } from './service'
import { createTestApp, TestContainer } from '../../tests/app'
import { IAppConfig, Config } from '../../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../'
import { AppServices } from '../../app'
import { createAsset } from '../../tests/asset'
import { createIncomingPayment } from '../../tests/incomingPayment'
import { createQuote, mockQuote } from '../../tests/quote'
import {
  createWalletAddress,
  MockWalletAddress
} from '../../tests/walletAddress'
import { truncateTables } from '../../tests/tableManager'
import { AssetOptions } from '../../asset/service'
import {
  IncomingPayment,
  IncomingPaymentState
} from '../payment/incoming/model'
import { getTests } from '../wallet_address/model.test'
import { WalletAddress } from '../wallet_address/model'
import { Fee, FeeType } from '../../fee/model'
import { Asset } from '../../asset/model'
import { PaymentMethodHandlerService } from '../../payment-method/handler/service'
import { ReceiverService } from '../receiver/service'
import { createReceiver } from '../../tests/receiver'
import {
  PaymentMethodHandlerError,
  PaymentMethodHandlerErrorCode
} from '../../payment-method/handler/errors'
import { Receiver } from '../receiver/model'

describe('QuoteService', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let quoteService: QuoteService
  let paymentMethodHandlerService: PaymentMethodHandlerService
  let receiverService: ReceiverService
  let knex: Knex
  let sendingWalletAddress: MockWalletAddress
  let receivingWalletAddress: MockWalletAddress
  let config: IAppConfig
  let receiverGet: typeof receiverService.get
  let receiverGetSpy: jest.SpyInstance<
    Promise<Receiver | undefined>,
    [url: string],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >

  const asset: AssetOptions = {
    scale: 9,
    code: 'USD'
  }

  const debitAmount = {
    value: BigInt(123),
    assetCode: asset.code,
    assetScale: asset.scale
  }

  const destinationAsset = {
    scale: 9,
    code: 'XRP'
  }

  const receiveAmount = {
    value: BigInt(56),
    assetCode: destinationAsset.code,
    assetScale: destinationAsset.scale
  }

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({
      ...Config,
      localCacheDuration: 0
    })
    appContainer = await createTestApp(deps)

    knex = appContainer.knex
    config = await deps.use('config')
    quoteService = await deps.use('quoteService')
    paymentMethodHandlerService = await deps.use('paymentMethodHandlerService')
    receiverService = await deps.use('receiverService')
  })

  beforeEach(async (): Promise<void> => {
    const { id: sendAssetId } = await createAsset(deps, {
      code: debitAmount.assetCode,
      scale: debitAmount.assetScale
    })
    sendingWalletAddress = await createWalletAddress(deps, {
      tenantId: config.operatorTenantId,
      assetId: sendAssetId
    })
    const { id: destinationAssetId } = await createAsset(deps, destinationAsset)
    receivingWalletAddress = await createWalletAddress(deps, {
      tenantId: config.operatorTenantId,
      assetId: destinationAssetId,
      mockServerPort: appContainer.openPaymentsPort
    })

    // Make receivers non-local by default
    receiverGet = receiverService.get
    receiverGetSpy = jest
      .spyOn(receiverService, 'get')
      .mockImplementation(async (url: string) => {
        // call original instead of receiverService.get to avoid infinite loop
        const receiver = await receiverGet.call(receiverService, url)
        if (receiver) {
          // "as any" to circumvent "readonly" check (compile time only) to allow overriding "isLocal" here
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(receiver.isLocal as any) = false
          return receiver
        }
        return undefined
      })
  })

  afterEach(async (): Promise<void> => {
    jest.restoreAllMocks()

    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get/getWalletAddressPage', (): void => {
    getTests({
      createModel: ({ client }) =>
        createQuote(deps, {
          walletAddressId: sendingWalletAddress.id,
          receiver: `${receivingWalletAddress.url}/incoming-payments/${uuid()}`,
          debitAmount: {
            value: BigInt(56),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          client,
          validDestination: false,
          withFee: true,
          method: 'ilp'
        }),
      get: (options) => quoteService.get(options),
      list: (options) => quoteService.getWalletAddressPage(options)
    })
  })

  describe('create', (): void => {
    const incomingAmount = {
      ...receiveAmount,
      value: BigInt(1000)
    }

    describe.each`
      incomingAmount    | description
      ${undefined}      | ${'incomingPayment'}
      ${incomingAmount} | ${'incomingPayment.incomingAmount'}
    `('$description', ({ incomingAmount }): void => {
      describe.each`
        debitAmount    | receiveAmount    | description
        ${debitAmount} | ${undefined}     | ${'debitAmount'}
        ${undefined}   | ${receiveAmount} | ${'receiveAmount'}
        ${undefined}   | ${undefined}     | ${'receiver.incomingAmount'}
      `('$description', ({ debitAmount, receiveAmount }): void => {
        let options: CreateQuoteOptions
        let incomingPayment: IncomingPayment
        const client = faker.internet.url({ appendSlash: false })

        beforeEach(async (): Promise<void> => {
          incomingPayment = await createIncomingPayment(deps, {
            walletAddressId: receivingWalletAddress.id,
            incomingAmount,
            tenantId: Config.operatorTenantId
          })
          options = {
            walletAddressId: sendingWalletAddress.id,
            receiver: incomingPayment.getUrl(receivingWalletAddress),
            method: 'ilp'
          }
          if (debitAmount) options.debitAmount = debitAmount
          if (receiveAmount) options.receiveAmount = receiveAmount
        })

        if (!debitAmount && !receiveAmount && !incomingAmount) {
          test('fails without receiver.incomingAmount', async (): Promise<void> => {
            await expect(quoteService.create(options)).resolves.toEqual(
              QuoteError.InvalidReceiver
            )
          })
        } else {
          if (debitAmount || receiveAmount) {
            test.each`
              client       | description
              ${client}    | ${'with a client'}
              ${undefined} | ${'without a client'}
            `(
              'creates a Quote $description',
              async ({ client }): Promise<void> => {
                const mockedQuote = mockQuote({
                  receiver: (await receiverService.get(
                    incomingPayment.getUrl(receivingWalletAddress)
                  ))!,
                  walletAddress: sendingWalletAddress,
                  exchangeRate: 0.5,
                  ...(debitAmount
                    ? { debitAmountValue: debitAmount.value }
                    : {
                        receiveAmountValue: receiveAmount
                          ? receiveAmount.value
                          : incomingAmount.value
                      })
                })

                const getQuoteSpy = jest
                  .spyOn(paymentMethodHandlerService, 'getQuote')
                  .mockResolvedValueOnce(mockedQuote)

                const quote = await quoteService.create({
                  ...options,
                  client
                })
                assert.ok(!isQuoteError(quote))

                expect(getQuoteSpy).toHaveBeenCalledTimes(1)
                expect(getQuoteSpy).toHaveBeenCalledWith(
                  'ILP',
                  expect.objectContaining({
                    walletAddress: sendingWalletAddress,
                    receiver: expect.anything(),
                    receiveAmount: options.receiveAmount,
                    debitAmount: options.debitAmount
                  }),
                  expect.anything()
                )

                expect(quote).toMatchObject({
                  walletAddressId: sendingWalletAddress.id,
                  receiver: options.receiver,
                  debitAmount: debitAmount || mockedQuote.debitAmount,
                  receiveAmount: receiveAmount || mockedQuote.receiveAmount,
                  createdAt: expect.any(Date),
                  updatedAt: expect.any(Date),
                  expiresAt: new Date(
                    quote.createdAt.getTime() + config.quoteLifespan
                  ),
                  client: client || null
                })

                await expect(
                  quoteService.get({
                    id: quote.id
                  })
                ).resolves.toEqual(quote)
              }
            )

            if (incomingAmount) {
              test('fails if receiveAmount exceeds receiver.incomingAmount', async (): Promise<void> => {
                const mockedQuote = mockQuote({
                  receiver: (await receiverService.get(
                    incomingPayment.getUrl(receivingWalletAddress)
                  ))!,
                  walletAddress: sendingWalletAddress,
                  exchangeRate: 0.5,
                  ...(debitAmount
                    ? { debitAmountValue: debitAmount.value }
                    : {
                        receiveAmountValue: receiveAmount
                          ? receiveAmount.value
                          : incomingAmount.value
                      })
                })

                jest
                  .spyOn(paymentMethodHandlerService, 'getQuote')
                  .mockResolvedValueOnce(mockedQuote)

                await incomingPayment.$query(knex).patch({
                  incomingAmount: {
                    value: BigInt(1),
                    assetCode: destinationAsset.code,
                    assetScale: destinationAsset.scale
                  }
                })
                await expect(quoteService.create(options)).resolves.toEqual(
                  QuoteError.InvalidAmount
                )
              })
            }
          } else if (incomingAmount) {
            test.each`
              client       | description
              ${client}    | ${'with a client'}
              ${undefined} | ${'without a client'}
            `(
              'creates a Quote $description',
              async ({ client }): Promise<void> => {
                const mockedQuote = mockQuote({
                  receiver: (await receiverService.get(
                    incomingPayment.getUrl(receivingWalletAddress)
                  ))!,
                  walletAddress: sendingWalletAddress,
                  exchangeRate: 0.5,
                  ...(debitAmount
                    ? { debitAmountValue: debitAmount.value }
                    : {
                        receiveAmountValue: receiveAmount
                          ? receiveAmount.value
                          : incomingAmount.value
                      })
                })

                jest
                  .spyOn(paymentMethodHandlerService, 'getQuote')
                  .mockResolvedValueOnce(mockedQuote)

                const quote = await quoteService.create({
                  ...options,
                  client
                })
                assert.ok(!isQuoteError(quote))

                expect(quote).toMatchObject({
                  ...options,
                  debitAmount: mockedQuote.debitAmount,
                  receiveAmount: incomingAmount,
                  createdAt: expect.any(Date),
                  updatedAt: expect.any(Date),
                  expiresAt: new Date(
                    quote.createdAt.getTime() + config.quoteLifespan
                  ),
                  client: client || null
                })

                await expect(
                  quoteService.get({
                    id: quote.id
                  })
                ).resolves.toEqual(quote)
              }
            )
          }

          test.each`
            state
            ${IncomingPaymentState.Completed}
            ${IncomingPaymentState.Expired}
          `(
            `returns ${QuoteError.InvalidReceiver} on $state receiver`,
            async ({ state }): Promise<void> => {
              await incomingPayment.$query(knex).patch({
                state,
                expiresAt:
                  state === IncomingPaymentState.Expired
                    ? new Date()
                    : undefined
              })
              await expect(quoteService.create(options)).resolves.toEqual(
                QuoteError.InvalidReceiver
              )
            }
          )
        }
      })
    })

    test.each`
      expiryDate                                                            | description
      ${new Date(new Date().getTime() + Config.quoteLifespan - 2 * 60_000)} | ${"the incoming payment's expirataion date"}
      ${new Date(new Date().getTime() + Config.quoteLifespan + 2 * 60_000)} | ${"the quotation's creation date plus its lifespan"}
    `(
      'sets expiry date to $description',
      async ({ expiryDate }): Promise<void> => {
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: receivingWalletAddress.id,
          incomingAmount,
          expiresAt: expiryDate,
          tenantId: Config.operatorTenantId
        })
        const options: CreateQuoteOptions = {
          walletAddressId: sendingWalletAddress.id,
          receiver: incomingPayment.getUrl(receivingWalletAddress),
          receiveAmount,
          method: 'ilp'
        }

        const mockedQuote = mockQuote({
          receiver: (await receiverService.get(
            incomingPayment.getUrl(receivingWalletAddress)
          ))!,
          walletAddress: sendingWalletAddress,
          receiveAmountValue: receiveAmount.value,
          exchangeRate: 0.5
        })

        jest
          .spyOn(paymentMethodHandlerService, 'getQuote')
          .mockResolvedValueOnce(mockedQuote)

        const quote = await quoteService.create(options)
        assert.ok(!isQuoteError(quote))
        const maxExpiration = new Date(
          quote.createdAt.getTime() + config.quoteLifespan
        )
        expect(quote).toMatchObject({
          walletAddressId: sendingWalletAddress.id,
          receiver: options.receiver,
          debitAmount: mockedQuote.debitAmount,
          receiveAmount: receiveAmount,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          expiresAt:
            maxExpiration.getTime() > expiryDate.getTime()
              ? expiryDate
              : maxExpiration
        })
      }
    )

    test('fails on unknown wallet address', async (): Promise<void> => {
      await expect(
        quoteService.create({
          walletAddressId: uuid(),
          receiver: `${receivingWalletAddress.url}/incoming-payments/${uuid()}`,
          debitAmount,
          method: 'ilp'
        })
      ).resolves.toEqual(QuoteError.UnknownWalletAddress)
    })

    test('fails on inactive wallet address', async () => {
      const walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId
      })
      const walletAddressUpdated = await WalletAddress.query(
        knex
      ).patchAndFetchById(walletAddress.id, { deactivatedAt: new Date() })
      assert.ok(!walletAddressUpdated.isActive)
      await expect(
        quoteService.create({
          walletAddressId: walletAddress.id,
          receiver: `${receivingWalletAddress.url}/incoming-payments/${uuid()}`,
          debitAmount,
          method: 'ilp'
        })
      ).resolves.toEqual(QuoteError.InactiveWalletAddress)
    })

    test('fails on invalid receiver', async (): Promise<void> => {
      await expect(
        quoteService.create({
          walletAddressId: sendingWalletAddress.id,
          receiver: `${receivingWalletAddress.url}/incoming-payments/${uuid()}`,
          debitAmount,
          method: 'ilp'
        })
      ).resolves.toEqual(QuoteError.InvalidReceiver)
    })

    test('fails on non-positive receive amount from quote', async (): Promise<void> => {
      const receiver = await createReceiver(deps, receivingWalletAddress)

      jest
        .spyOn(paymentMethodHandlerService, 'getQuote')
        .mockImplementationOnce(() => {
          throw new PaymentMethodHandlerError('Failed getting quote', {
            code: PaymentMethodHandlerErrorCode.QuoteNonPositiveReceiveAmount,
            description: 'Non positive receive amount for quote'
          })
        })

      await expect(
        quoteService.create({
          walletAddressId: sendingWalletAddress.id,
          receiver: receiver.incomingPayment!.id,
          method: 'ilp',
          debitAmount: {
            value: 2n,
            assetCode: sendingWalletAddress.asset.code,
            assetScale: sendingWalletAddress.asset.scale
          }
        })
      ).resolves.toBe(QuoteError.NonPositiveReceiveAmount)
    })

    test.each`
      debitAmount                              | receiveAmount                              | description
      ${{ ...debitAmount, value: BigInt(0) }}  | ${undefined}                               | ${'with debitAmount of zero'}
      ${{ ...debitAmount, value: BigInt(-1) }} | ${undefined}                               | ${'with negative debitAmount'}
      ${{ ...debitAmount, assetScale: 3 }}     | ${undefined}                               | ${'with wrong debitAmount asset'}
      ${undefined}                             | ${{ ...receiveAmount, value: BigInt(0) }}  | ${'with receiveAmount of zero'}
      ${undefined}                             | ${{ ...receiveAmount, value: BigInt(-1) }} | ${'with negative receiveAmount'}
      ${undefined}                             | ${{ ...receiveAmount, assetScale: 3 }}     | ${'with wrong receiveAmount asset'}
      ${debitAmount}                           | ${receiveAmount}                           | ${'with both send and receive amount'}
    `(
      'fails to create $description',
      async ({ debitAmount, receiveAmount }): Promise<void> => {
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: receivingWalletAddress.id,
          tenantId: Config.operatorTenantId
        })
        const options: CreateQuoteOptions = {
          walletAddressId: sendingWalletAddress.id,
          receiver: incomingPayment.getUrl(receivingWalletAddress),
          method: 'ilp'
        }
        if (debitAmount) options.debitAmount = debitAmount
        if (receiveAmount) options.receiveAmount = receiveAmount
        await expect(quoteService.create(options)).resolves.toEqual(
          QuoteError.InvalidAmount
        )
      }
    )

    describe('fees - fixed delivery', (): void => {
      let asset: Asset
      let sendingWalletAddress: WalletAddress
      let receivingWalletAddress: WalletAddress

      beforeEach(async (): Promise<void> => {
        asset = await createAsset(deps, {
          code: 'USD',
          scale: 2
        })
        sendingWalletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId,
          assetId: asset.id
        })
        receivingWalletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId,
          assetId: asset.id
        })
      })

      test.each`
        incomingAmountValue | fixedFee | basisPointFee | expectedQuoteDebitAmountValue | description
        ${1000}             | ${0}     | ${0}          | ${1000n}                      | ${'no fees'}
        ${1000n}            | ${150}   | ${0}          | ${1150n}                      | ${'fixed fee'}
        ${1000n}            | ${0}     | ${200}        | ${1020n}                      | ${'basis point fee'}
        ${1000n}            | ${150}   | ${200}        | ${1170n}                      | ${'fixed and basis point fee'}
      `(
        '$description',
        async ({
          incomingAmountValue,
          fixedFee,
          basisPointFee,
          expectedQuoteDebitAmountValue
        }): Promise<void> => {
          const receiver = await createReceiver(deps, receivingWalletAddress, {
            incomingAmount: {
              assetCode: asset.code,
              assetScale: asset.scale,
              value: incomingAmountValue
            },
            tenantId: Config.operatorTenantId
          })

          await Fee.query().insertAndFetch({
            assetId: asset.id,
            type: FeeType.Sending,
            fixedFee,
            basisPointFee
          })

          const mockedQuote = mockQuote({
            receiver: receiver!,
            walletAddress: sendingWalletAddress,
            receiveAmountValue: incomingAmountValue
          })

          jest
            .spyOn(paymentMethodHandlerService, 'getQuote')
            .mockResolvedValueOnce(mockedQuote)

          const quote = await quoteService.create({
            walletAddressId: sendingWalletAddress.id,
            receiver: receiver.incomingPayment!.id,
            method: 'ilp'
          })
          assert.ok(!isQuoteError(quote))

          expect(quote.debitAmount).toEqual({
            assetCode: asset.code,
            assetScale: asset.scale,
            value: expectedQuoteDebitAmountValue
          })
        }
      )

      test('fails on invalid debit amount', async () => {
        const incomingAmountValue = 100n
        const receiver = await createReceiver(deps, receivingWalletAddress, {
          incomingAmount: {
            assetCode: asset.code,
            assetScale: asset.scale,
            value: incomingAmountValue
          },
          tenantId: Config.operatorTenantId
        })

        const mockedQuote = mockQuote({
          receiver: receiver!,
          walletAddress: sendingWalletAddress,
          receiveAmountValue: incomingAmountValue,
          debitAmountValue: -10n
        })

        jest
          .spyOn(paymentMethodHandlerService, 'getQuote')
          .mockResolvedValueOnce(mockedQuote)

        await expect(
          quoteService.create({
            walletAddressId: sendingWalletAddress.id,
            receiver: receiver.incomingPayment!.id,
            method: 'ilp'
          })
        ).resolves.toEqual(QuoteError.InvalidAmount)
      })
    })

    describe('fees - fixed send with cross-currency', (): void => {
      let sendAsset: Asset
      let receiveAsset: Asset
      let sendingWalletAddress: WalletAddress
      let receivingWalletAddress: WalletAddress

      beforeEach(async (): Promise<void> => {
        sendAsset = await createAsset(deps, {
          code: 'USD',
          scale: 2
        })
        receiveAsset = await createAsset(deps, {
          code: 'XRP',
          scale: 2
        })
        sendingWalletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId,
          assetId: sendAsset.id
        })
        receivingWalletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId,
          assetId: receiveAsset.id
        })
      })

      test.each`
        debitAmountValue | fixedFee | basisPointFee | exchangeRate | expectedReceiveAmountValue | description
        ${200n}          | ${0}     | ${0}          | ${0.5}       | ${100n}                    | ${'no fees'}
        ${200n}          | ${0}     | ${0}          | ${1.0}       | ${200n}                    | ${'no fees, equal exchange rate'}
        ${200n}          | ${20}    | ${0}          | ${0.5}       | ${90n}                     | ${'fixed fee'}
        ${200n}          | ${101n}  | ${0}          | ${1.0}       | ${99n}                     | ${'fixed fee larger than receiveAmount, equal exchange rate'}
        ${200n}          | ${0}     | ${200}        | ${0.5}       | ${99n}                     | ${'basis point fee'}
        ${200n}          | ${20}    | ${200}        | ${0.5}       | ${89n}                     | ${'fixed and basis point fee'}
        ${200n}          | ${20}    | ${200}        | ${0.455}     | ${80n}                     | ${'fixed and basis point fee with floating exchange rate'}
      `(
        '$description',
        async ({
          debitAmountValue,
          fixedFee,
          basisPointFee,
          expectedReceiveAmountValue,
          exchangeRate
        }): Promise<void> => {
          const receiver = await createReceiver(deps, receivingWalletAddress)

          await Fee.query().insertAndFetch({
            assetId: sendAsset.id,
            type: FeeType.Sending,
            fixedFee,
            basisPointFee
          })

          const mockedQuote = mockQuote({
            receiver,
            walletAddress: sendingWalletAddress,
            debitAmountValue,
            exchangeRate
          })

          jest
            .spyOn(paymentMethodHandlerService, 'getQuote')
            .mockResolvedValueOnce(mockedQuote)

          const quote = await quoteService.create({
            walletAddressId: sendingWalletAddress.id,
            receiver: receiver.incomingPayment!.id,
            debitAmount: {
              value: debitAmountValue,
              assetCode: sendAsset.code,
              assetScale: sendAsset.scale
            },
            method: 'ilp'
          })
          assert.ok(!isQuoteError(quote))

          expect(quote.receiveAmount).toEqual({
            assetCode: receiveAsset.code,
            assetScale: receiveAsset.scale,
            value: expectedReceiveAmountValue
          })
        }
      )

      test('fails on non-positive receive amount', async () => {
        const receiver = await createReceiver(deps, receivingWalletAddress)
        const debitAmountValue = 100n

        await Fee.query().insertAndFetch({
          assetId: sendAsset.id,
          type: FeeType.Sending,
          fixedFee: debitAmountValue + 1n,
          basisPointFee: 0
        })

        const mockedQuote = mockQuote({
          receiver,
          walletAddress: sendingWalletAddress,
          debitAmountValue: debitAmountValue,
          exchangeRate: 1.0
        })

        jest
          .spyOn(paymentMethodHandlerService, 'getQuote')
          .mockResolvedValueOnce(mockedQuote)

        await expect(
          quoteService.create({
            walletAddressId: sendingWalletAddress.id,
            receiver: receiver.incomingPayment!.id,
            debitAmount: {
              value: debitAmountValue,
              assetCode: sendAsset.code,
              assetScale: sendAsset.scale
            },
            method: 'ilp'
          })
        ).resolves.toEqual(QuoteError.NonPositiveReceiveAmount)
      })
    })

    describe('Local Receiver', (): void => {
      beforeEach(() => {
        receiverGetSpy.mockRestore()
      })
      test('Local receiver uses local payment method', async () => {
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: receivingWalletAddress.id,
          incomingAmount,
          tenantId: Config.operatorTenantId
        })

        const options: CreateQuoteOptions = {
          walletAddressId: sendingWalletAddress.id,
          receiver: incomingPayment.getUrl(receivingWalletAddress),
          method: 'ilp'
        }

        const mockedQuote = mockQuote({
          receiver: (await receiverService.get(
            incomingPayment.getUrl(receivingWalletAddress)
          ))!,
          walletAddress: sendingWalletAddress,
          exchangeRate: 0.5,
          debitAmountValue: debitAmount.value
        })

        const getQuoteSpy = jest
          .spyOn(paymentMethodHandlerService, 'getQuote')
          .mockResolvedValueOnce(mockedQuote)

        const quote = await quoteService.create(options)
        assert.ok(!isQuoteError(quote))

        expect(getQuoteSpy).toHaveBeenCalledTimes(1)
        expect(getQuoteSpy).toHaveBeenCalledWith(
          'LOCAL',
          expect.objectContaining({
            walletAddress: sendingWalletAddress,
            receiver: expect.anything(),
            receiveAmount: options.receiveAmount,
            debitAmount: options.debitAmount
          }),
          expect.anything()
        )

        expect(quote).toMatchObject({
          walletAddressId: sendingWalletAddress.id,
          receiver: options.receiver,
          debitAmount: mockedQuote.debitAmount,
          receiveAmount: mockedQuote.receiveAmount,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          expiresAt: new Date(quote.createdAt.getTime() + config.quoteLifespan)
        })

        await expect(
          quoteService.get({
            id: quote.id
          })
        ).resolves.toEqual(quote)
      })
    })
  })
})
