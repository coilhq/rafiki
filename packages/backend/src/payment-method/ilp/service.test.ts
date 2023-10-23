import nock from 'nock'
import { IlpPaymentService, retryableIlpErrors } from './service'
import { initIocContainer } from '../../'
import { createTestApp, TestContainer } from '../../tests/app'
import { IAppConfig, Config } from '../../config/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { createAsset } from '../../tests/asset'
import { createWalletAddress } from '../../tests/walletAddress'
import { Asset } from '../../asset/model'
import { withConfigOverride } from '../../tests/helpers'
import { StartQuoteOptions } from '../handler/service'
import { WalletAddress } from '../../open_payments/wallet_address/model'
import * as Pay from '@interledger/pay'

import { createReceiver } from '../../tests/receiver'
import { mockRatesApi } from '../../tests/rates'
import { PaymentMethodHandlerError } from '../handler/errors'
import { OutgoingPayment } from '../../open_payments/payment/outgoing/model'
import { AccountingService } from '../../accounting/service'
import { IncomingPayment } from '../../open_payments/payment/incoming/model'
import { truncateTables } from '../../tests/tableManager'
import { createOutgoingPaymentWithReceiver } from '../../tests/outgoingPayment'

describe('IlpPaymentService', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let ilpPaymentService: IlpPaymentService
  let accountingService: AccountingService
  let config: IAppConfig

  const exchangeRatesUrl = 'https://example-rates.com'

  const assetMap: Record<string, Asset> = {}
  const walletAddressMap: Record<string, WalletAddress> = {}

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({
      ...Config,
      exchangeRatesUrl,
      exchangeRatesLifetime: 0
    })
    appContainer = await createTestApp(deps)

    config = await deps.use('config')
    ilpPaymentService = await deps.use('ilpPaymentService')
    accountingService = await deps.use('accountingService')
  })

  beforeEach(async (): Promise<void> => {
    assetMap['USD'] = await createAsset(deps, {
      code: 'USD',
      scale: 2
    })

    assetMap['EUR'] = await createAsset(deps, {
      code: 'EUR',
      scale: 2
    })

    walletAddressMap['USD'] = await createWalletAddress(deps, {
      assetId: assetMap['USD'].id
    })

    walletAddressMap['EUR'] = await createWalletAddress(deps, {
      assetId: assetMap['EUR'].id
    })
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
    jest.restoreAllMocks()
    nock.cleanAll()
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('getQuote', (): void => {
    test('calls rates service with correct base asset', async (): Promise<void> => {
      const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({}))

      const options: StartQuoteOptions = {
        walletAddress: walletAddressMap['USD'],
        receiver: await createReceiver(deps, walletAddressMap['USD']),
        debitAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: 100n
        }
      }

      const ratesService = await deps.use('ratesService')
      const ratesServiceSpy = jest.spyOn(ratesService, 'rates')

      await ilpPaymentService.getQuote(options)

      expect(ratesServiceSpy).toHaveBeenCalledWith('USD')
      ratesScope.done()
    })

    test('fails on rate service error', async (): Promise<void> => {
      const ratesService = await deps.use('ratesService')
      jest
        .spyOn(ratesService, 'rates')
        .mockImplementation(() => Promise.reject(new Error('fail')))

      await expect(
        ilpPaymentService.getQuote({
          walletAddress: walletAddressMap['USD'],
          receiver: await createReceiver(deps, walletAddressMap['USD']),
          debitAmount: {
            assetCode: 'USD',
            assetScale: 2,
            value: 100n
          }
        })
      ).rejects.toThrow('missing rates')
    })

    test('returns all fields correctly', async (): Promise<void> => {
      const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({}))

      const options: StartQuoteOptions = {
        walletAddress: walletAddressMap['USD'],
        receiver: await createReceiver(deps, walletAddressMap['USD']),
        debitAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: 100n
        }
      }

      await expect(ilpPaymentService.getQuote(options)).resolves.toEqual({
        receiver: options.receiver,
        walletAddress: options.walletAddress,
        debitAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: 100n
        },
        receiveAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: 99n
        },
        estimatedExchangeRate: expect.any(Number),
        additionalFields: {
          minExchangeRate: expect.any(Pay.Ratio),
          highEstimatedExchangeRate: expect.any(Pay.Ratio),
          lowEstimatedExchangeRate: expect.any(Pay.Ratio),
          maxPacketAmount: BigInt(Pay.Int.MAX_U64.toString())
        }
      })
      ratesScope.done()
    })

    test('uses receiver.incomingAmount if receiveAmount is not provided', async (): Promise<void> => {
      const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({}))

      const incomingAmount = {
        assetCode: 'USD',
        assetScale: 2,
        value: 100n
      }

      const options: StartQuoteOptions = {
        walletAddress: walletAddressMap['USD'],
        receiver: await createReceiver(deps, walletAddressMap['USD'], {
          incomingAmount
        })
      }

      const ilpStartQuoteSpy = jest.spyOn(Pay, 'startQuote')

      await expect(ilpPaymentService.getQuote(options)).resolves.toMatchObject({
        receiveAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: incomingAmount?.value
        }
      })

      expect(ilpStartQuoteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          amountToDeliver: incomingAmount?.value
        })
      )
      ratesScope.done()
    })

    test('fails if slippage too high', async (): Promise<void> =>
      withConfigOverride(
        () => config,
        { slippage: 101 },
        async () => {
          mockRatesApi(exchangeRatesUrl, () => ({}))

          try {
            await ilpPaymentService.getQuote({
              walletAddress: walletAddressMap['USD'],
              receiver: await createReceiver(deps, walletAddressMap['USD']),
              debitAmount: {
                assetCode: 'USD',
                assetScale: 2,
                value: 100n
              }
            })
          } catch (error) {
            expect(error).toBeInstanceOf(PaymentMethodHandlerError)
            expect((error as PaymentMethodHandlerError).message).toBe(
              'Received error during ILP quoting'
            )
            expect((error as PaymentMethodHandlerError).description).toBe(
              Pay.PaymentError.InvalidSlippage
            )
            expect((error as PaymentMethodHandlerError).retryable).toBe(false)
          }
        }
      )())

    test('throws if quote returns invalid maxSourceAmount', async (): Promise<void> => {
      const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({}))

      const options: StartQuoteOptions = {
        walletAddress: walletAddressMap['USD'],
        receiver: await createReceiver(deps, walletAddressMap['USD'])
      }

      jest.spyOn(Pay, 'startQuote').mockResolvedValueOnce({
        maxSourceAmount: -1n
      } as Pay.Quote)

      try {
        await ilpPaymentService.getQuote(options)
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Received error during ILP quoting'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          'Invalid maxSourceAmount'
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(false)
      }

      ratesScope.done()
    })

    test('throws if quote returns invalid minDeliveryAmount', async (): Promise<void> => {
      const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({}))

      const options: StartQuoteOptions = {
        walletAddress: walletAddressMap['USD'],
        receiver: await createReceiver(deps, walletAddressMap['USD'], {
          incomingAmount: {
            assetCode: 'USD',
            assetScale: 2,
            value: 100n
          }
        })
      }

      jest.spyOn(Pay, 'startQuote').mockResolvedValueOnce({
        maxSourceAmount: 1n,
        minDeliveryAmount: -1n
      } as Pay.Quote)

      try {
        await ilpPaymentService.getQuote(options)
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Received error during ILP quoting'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          'Invalid minDeliveryAmount'
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(false)
      }

      ratesScope.done()
    })

    describe('successfully gets ilp quote', (): void => {
      describe('with incomingAmount', () => {
        test.each`
          incomingAssetCode | incomingAmountValue | debitAssetCode | expectedDebitAmount | exchangeRate | slippage | description
          ${'EUR'}          | ${100n}             | ${'USD'}       | ${101n}             | ${1.0}       | ${0}     | ${'same currency, no slippage'}
          ${'USD'}          | ${100n}             | ${'USD'}       | ${102n}             | ${1.0}       | ${0.01}  | ${'same currency, some slippage'}
          ${'EUR'}          | ${100n}             | ${'USD'}       | ${113n}             | ${0.9}       | ${0.01}  | ${'cross currency, exchange rate < 1'}
          ${'EUR'}          | ${100n}             | ${'USD'}       | ${51n}              | ${2.0}       | ${0.01}  | ${'cross currency, exchange rate > 1'}
        `(
          '$description',
          async ({
            incomingAssetCode,
            incomingAmountValue,
            debitAssetCode,
            expectedDebitAmount,
            slippage,
            exchangeRate
          }): Promise<void> =>
            withConfigOverride(
              () => config,
              { slippage },
              async () => {
                const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({
                  [incomingAssetCode]: exchangeRate
                }))

                const receivingWalletAddress =
                  walletAddressMap[incomingAssetCode]
                const sendingWalletAddress = walletAddressMap[debitAssetCode]

                const options: StartQuoteOptions = {
                  walletAddress: sendingWalletAddress,
                  receiver: await createReceiver(deps, receivingWalletAddress),
                  receiveAmount: {
                    assetCode: receivingWalletAddress.asset.code,
                    assetScale: receivingWalletAddress.asset.scale,
                    value: incomingAmountValue
                  }
                }

                const quote = await ilpPaymentService.getQuote(options)

                expect(quote).toMatchObject({
                  debitAmount: {
                    assetCode: sendingWalletAddress.asset.code,
                    assetScale: sendingWalletAddress.asset.scale,
                    value: expectedDebitAmount
                  },
                  receiveAmount: {
                    assetCode: receivingWalletAddress.asset.code,
                    assetScale: receivingWalletAddress.asset.scale,
                    value: incomingAmountValue
                  }
                })
                ratesScope.done()
              }
            )()
        )
      })

      describe('with debitAmount', () => {
        test.each`
          debitAssetCode | debitAmountValue | incomingAssetCode | expectedReceiveAmount | exchangeRate | slippage | description
          ${'USD'}       | ${100n}          | ${'USD'}          | ${99n}                | ${1.0}       | ${0}     | ${'same currency, no slippage'}
          ${'USD'}       | ${100n}          | ${'USD'}          | ${99n}                | ${1.0}       | ${0.01}  | ${'same currency, some slippage'}
          ${'USD'}       | ${100n}          | ${'EUR'}          | ${89n}                | ${0.9}       | ${0.01}  | ${'cross currency, exchange rate < 1'}
          ${'USD'}       | ${100n}          | ${'EUR'}          | ${197n}               | ${2.0}       | ${0.01}  | ${'cross currency, exchange rate > 1'}
        `(
          '$description',
          async ({
            incomingAssetCode,
            debitAmountValue,
            debitAssetCode,
            expectedReceiveAmount,
            slippage,
            exchangeRate
          }): Promise<void> =>
            withConfigOverride(
              () => config,
              { slippage },
              async () => {
                const ratesScope = mockRatesApi(exchangeRatesUrl, () => ({
                  [incomingAssetCode]: exchangeRate
                }))

                const receivingWalletAddress =
                  walletAddressMap[incomingAssetCode]
                const sendingWalletAddress = walletAddressMap[debitAssetCode]

                const options: StartQuoteOptions = {
                  walletAddress: sendingWalletAddress,
                  receiver: await createReceiver(deps, receivingWalletAddress),
                  debitAmount: {
                    assetCode: sendingWalletAddress.asset.code,
                    assetScale: sendingWalletAddress.asset.scale,
                    value: debitAmountValue
                  }
                }

                const quote = await ilpPaymentService.getQuote(options)

                expect(quote).toMatchObject({
                  debitAmount: {
                    assetCode: sendingWalletAddress.asset.code,
                    assetScale: sendingWalletAddress.asset.scale,
                    value: debitAmountValue
                  },
                  receiveAmount: {
                    assetCode: receivingWalletAddress.asset.code,
                    assetScale: receivingWalletAddress.asset.scale,
                    value: expectedReceiveAmount
                  }
                })
                ratesScope.done()
              }
            )()
        )
      })
    })
  })

  describe('pay', (): void => {
    function mockIlpPay(
      overrideQuote: Partial<Pay.Quote>,
      error?: Pay.PaymentError
    ): jest.SpyInstance<
      Promise<Pay.PaymentProgress>,
      [options: Pay.PayOptions]
    > {
      return jest
        .spyOn(Pay, 'pay')
        .mockImplementationOnce(async (opts: Pay.PayOptions) => {
          const res = await Pay.pay({
            ...opts,
            quote: { ...opts.quote, ...overrideQuote }
          })
          if (error) res.error = error
          return res
        })
    }

    async function validateBalances(
      outgoingPayment: OutgoingPayment,
      incomingPayment: IncomingPayment,
      {
        amountSent,
        amountReceived
      }: {
        amountSent: bigint
        amountReceived: bigint
      }
    ) {
      await expect(
        accountingService.getTotalSent(outgoingPayment.id)
      ).resolves.toBe(amountSent)
      await expect(
        accountingService.getTotalReceived(incomingPayment.id)
      ).resolves.toEqual(amountReceived)
    }

    test('successfully streams between accounts', async (): Promise<void> => {
      const { incomingPayment, receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      await expect(
        ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      ).resolves.toBeUndefined()

      await validateBalances(outgoingPayment, incomingPayment, {
        amountSent: 100n,
        amountReceived: 100n
      })
    })

    test('partially streams between accounts, then streams to completion', async (): Promise<void> => {
      const { incomingPayment, receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            exchangeRate: 1,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      mockIlpPay(
        { maxSourceAmount: 5n, minDeliveryAmount: 5n },
        Pay.PaymentError.ClosedByReceiver
      )

      await expect(
        ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      ).rejects.toThrow(PaymentMethodHandlerError)

      await validateBalances(outgoingPayment, incomingPayment, {
        amountSent: 5n,
        amountReceived: 5n
      })

      await expect(
        ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n - 5n,
          finalReceiveAmount: 100n - 5n
        })
      ).resolves.toBeUndefined()

      await validateBalances(outgoingPayment, incomingPayment, {
        amountSent: 100n,
        amountReceived: 100n
      })
    })

    test('throws if invalid finalDebitAmount', async (): Promise<void> => {
      const { incomingPayment, receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      try {
        await ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 0n,
          finalReceiveAmount: 50n
        })
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Could not start ILP streaming'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          'Invalid finalDebitAmount'
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(false)
      }

      await validateBalances(outgoingPayment, incomingPayment, {
        amountSent: 0n,
        amountReceived: 0n
      })
    })

    test('throws if invalid finalReceiveAmount', async (): Promise<void> => {
      const { incomingPayment, receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      try {
        await ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 50n,
          finalReceiveAmount: 0n
        })
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Could not start ILP streaming'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          'Invalid finalReceiveAmount'
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(false)
      }

      await validateBalances(outgoingPayment, incomingPayment, {
        amountSent: 0n,
        amountReceived: 0n
      })
    })

    test('throws retryable ILP error', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      mockIlpPay({}, Object.keys(retryableIlpErrors)[0] as Pay.PaymentError)

      try {
        await ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 50n,
          finalReceiveAmount: 50n
        })
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Received error during ILP pay'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          Object.keys(retryableIlpErrors)[0]
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(true)
      }
    })

    test('throws non-retryable ILP error', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      const nonRetryableIlpError = Object.values(Pay.PaymentError).find(
        (error) => !retryableIlpErrors[error]
      )

      mockIlpPay({}, nonRetryableIlpError)

      try {
        await ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 50n,
          finalReceiveAmount: 50n
        })
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Received error during ILP pay'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          nonRetryableIlpError
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('throws if invalid quote data', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      outgoingPayment.quote.additionalFields.lowEstimatedExchangeRate = ''

      try {
        await ilpPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 50n,
          finalReceiveAmount: 50n
        })
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentMethodHandlerError)
        expect((error as PaymentMethodHandlerError).message).toBe(
          'Error parsing ILP quote'
        )
        expect((error as PaymentMethodHandlerError).description).toBe(
          'Invalid ratio value'
        )
        expect((error as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })
  })
})
