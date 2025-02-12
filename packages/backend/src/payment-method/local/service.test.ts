import { LocalPaymentService } from './service'
import { initIocContainer } from '../../'
import { createTestApp, TestContainer } from '../../tests/app'
import { Config } from '../../config/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { createAsset } from '../../tests/asset'
import { createWalletAddress } from '../../tests/walletAddress'
import { Asset } from '../../asset/model'
import { StartQuoteOptions } from '../handler/service'
import { WalletAddress } from '../../open_payments/wallet_address/model'

import { createReceiver } from '../../tests/receiver'
import { mockRatesApi } from '../../tests/rates'
import { AccountingService, Transaction } from '../../accounting/service'
import { truncateTables } from '../../tests/tableManager'
import { createOutgoingPaymentWithReceiver } from '../../tests/outgoingPayment'
import { OutgoingPayment } from '../../open_payments/payment/outgoing/model'
import {
  IncomingPayment,
  IncomingPaymentState
} from '../../open_payments/payment/incoming/model'
import { IncomingPaymentService } from '../../open_payments/payment/incoming/service'
import { errorToMessage, TransferError } from '../../accounting/errors'
import { PaymentMethodHandlerError } from '../handler/errors'
import { ConvertError } from '../../rates/service'

const nock = (global as unknown as { nock: typeof import('nock') }).nock

describe('LocalPaymentService', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let localPaymentService: LocalPaymentService
  let accountingService: AccountingService
  let incomingPaymentService: IncomingPaymentService
  let tenantId: string

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

    localPaymentService = await deps.use('localPaymentService')
    accountingService = await deps.use('accountingService')
    incomingPaymentService = await deps.use('incomingPaymentService')
  })

  beforeEach(async (): Promise<void> => {
    tenantId = Config.operatorTenantId
    assetMap['USD'] = await createAsset(deps, {
      code: 'USD',
      scale: 2
    })

    assetMap['USD_9'] = await createAsset(deps, {
      code: 'USD_9',
      scale: 9
    })

    assetMap['EUR'] = await createAsset(deps, {
      code: 'EUR',
      scale: 2
    })

    walletAddressMap['USD'] = await createWalletAddress(deps, {
      tenantId,
      assetId: assetMap['USD'].id
    })

    walletAddressMap['USD_9'] = await createWalletAddress(deps, {
      tenantId,
      assetId: assetMap['USD_9'].id
    })

    walletAddressMap['EUR'] = await createWalletAddress(deps, {
      tenantId,
      assetId: assetMap['EUR'].id
    })
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
    jest.restoreAllMocks()

    nock.cleanAll()
    nock.abortPendingRequests()
    nock.restore()
    nock.activate()
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('getQuote', (): void => {
    test('fails on unknown rate service error', async (): Promise<void> => {
      const ratesService = await deps.use('ratesService')
      jest
        .spyOn(ratesService, 'convertSource')
        .mockImplementation(() => Promise.reject(new Error('fail')))

      expect.assertions(4)
      try {
        await localPaymentService.getQuote({
          walletAddress: walletAddressMap['USD'],
          receiver: await createReceiver(deps, walletAddressMap['USD']),
          debitAmount: {
            assetCode: 'USD',
            assetScale: 2,
            value: 100n
          }
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local quoting'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          'Unknown error while attempting to convert rates'
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('fails on rate service error', async (): Promise<void> => {
      const ratesService = await deps.use('ratesService')
      jest
        .spyOn(ratesService, 'convertSource')
        .mockImplementation(() =>
          Promise.resolve(ConvertError.InvalidDestinationPrice)
        )

      expect.assertions(4)
      try {
        await localPaymentService.getQuote({
          walletAddress: walletAddressMap['USD'],
          receiver: await createReceiver(deps, walletAddressMap['USD']),
          debitAmount: {
            assetCode: 'USD',
            assetScale: 2,
            value: 100n
          }
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local quoting'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          'Failed to convert debitAmount to receive amount'
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('returns all fields correctly', async (): Promise<void> => {
      const options: StartQuoteOptions = {
        walletAddress: walletAddressMap['USD'],
        receiver: await createReceiver(deps, walletAddressMap['USD']),
        debitAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: 100n
        }
      }

      await expect(localPaymentService.getQuote(options)).resolves.toEqual({
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
          value: 100n
        },
        estimatedExchangeRate: 1
      })
    })

    test('fails if debit amount is non-positive', async (): Promise<void> => {
      expect.assertions(4)
      try {
        await localPaymentService.getQuote({
          walletAddress: walletAddressMap['USD'],
          receiver: await createReceiver(deps, walletAddressMap['USD']),
          debitAmount: {
            assetCode: 'USD',
            assetScale: 2,
            value: 0n
          }
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local quoting'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          'debit amount of local quote is non-positive'
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })
    test('fails if receive amount is non-positive', async (): Promise<void> => {
      const ratesService = await deps.use('ratesService')
      jest
        .spyOn(ratesService, 'convertDestination')
        .mockImplementation(() =>
          Promise.resolve({ amount: 100n, scaledExchangeRate: 1 })
        )
      expect.assertions(4)
      try {
        await localPaymentService.getQuote({
          walletAddress: walletAddressMap['USD'],
          receiver: await createReceiver(deps, walletAddressMap['USD']),
          receiveAmount: {
            assetCode: 'USD',
            assetScale: 2,
            value: 0n
          }
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local quoting'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          'receive amount of local quote is non-positive'
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('uses receiver.incomingAmount if receiveAmount is not provided', async (): Promise<void> => {
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

      await expect(
        localPaymentService.getQuote(options)
      ).resolves.toMatchObject({
        receiveAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: incomingAmount.value
        }
      })
    })

    describe('successfully gets local quote', (): void => {
      describe('with incomingAmount', () => {
        test.each`
          incomingAssetCode | incomingAmountValue | debitAssetCode | expectedDebitAmount | exchangeRate | description
          ${'USD'}          | ${100n}             | ${'USD'}       | ${100n}             | ${null}      | ${'local currency'}
          ${'EUR'}          | ${100n}             | ${'USD'}       | ${100n}             | ${1.0}       | ${'cross currency, same rate'}
          ${'EUR'}          | ${100n}             | ${'USD'}       | ${112n}             | ${0.9}       | ${'cross currency, exchange rate < 1'}
          ${'EUR'}          | ${100n}             | ${'USD'}       | ${50n}              | ${2.0}       | ${'cross currency, exchange rate > 1'}
          ${'USD_9'}        | ${100_000_000n}     | ${'USD'}       | ${10n}              | ${1.0}       | ${'local currency, different scale'}
        `(
          '$description',
          async ({
            incomingAssetCode,
            incomingAmountValue,
            debitAssetCode,
            expectedDebitAmount,
            exchangeRate
          }): Promise<void> => {
            if (incomingAssetCode !== 'USD_9') return
            let ratesScope

            if (incomingAssetCode !== debitAssetCode) {
              ratesScope = mockRatesApi(exchangeRatesUrl, () => ({
                [incomingAssetCode]: exchangeRate
              }))
            }

            const receivingWalletAddress = walletAddressMap[incomingAssetCode]
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

            const quote = await localPaymentService.getQuote(options)

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
            ratesScope && ratesScope.done()
          }
        )
      })

      describe('with debitAmount', () => {
        test.each`
          debitAssetCode | debitAmountValue | incomingAssetCode | expectedReceiveAmount | exchangeRate | description
          ${'USD'}       | ${100n}          | ${'USD'}          | ${100n}               | ${null}      | ${'local currency'}
          ${'EUR'}       | ${100n}          | ${'USD'}          | ${100n}               | ${1.0}       | ${'cross currency, same rate'}
          ${'USD'}       | ${100n}          | ${'EUR'}          | ${90n}                | ${0.9}       | ${'cross currency, exchange rate < 1'}
          ${'USD'}       | ${100n}          | ${'EUR'}          | ${200n}               | ${2.0}       | ${'cross currency, exchange rate > 1'}
        `(
          '$description',
          async ({
            incomingAssetCode,
            debitAmountValue,
            debitAssetCode,
            expectedReceiveAmount,
            exchangeRate
          }): Promise<void> => {
            let ratesScope

            if (debitAssetCode !== incomingAssetCode) {
              ratesScope = mockRatesApi(exchangeRatesUrl, () => ({
                [incomingAssetCode]: exchangeRate
              }))
            }

            const receivingWalletAddress = walletAddressMap[incomingAssetCode]
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

            const quote = await localPaymentService.getQuote(options)

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
            ratesScope && ratesScope.done()
          }
        )
      })
    })
  })

  describe('pay', (): void => {
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

    test('succesfully make local payment', async (): Promise<void> => {
      const { incomingPayment, receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      const payResponse = await localPaymentService.pay({
        receiver,
        outgoingPayment,
        finalDebitAmount: 100n,
        finalReceiveAmount: 100n
      })

      expect(payResponse).toBe(undefined)

      await validateBalances(outgoingPayment, incomingPayment, {
        amountSent: 100n,
        amountReceived: 100n
      })
    })

    test('throws error if incoming payment is not found', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      jest.spyOn(incomingPaymentService, 'get').mockResolvedValueOnce(undefined)

      expect.assertions(4)
      try {
        await localPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local payment'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          'Incoming payment not found from receiver'
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('throws error if incoming payment state is not pending', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      jest.spyOn(incomingPaymentService, 'get').mockResolvedValueOnce({
        state: IncomingPaymentState.Processing
      } as IncomingPayment)

      expect.assertions(4)
      try {
        await localPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Bad Incoming Payment State'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          `Incoming Payment state should be ${IncomingPaymentState.Pending}`
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('throws InsufficientBalance when balance is insufficient', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      jest
        .spyOn(accountingService, 'createTransfer')
        .mockResolvedValueOnce(TransferError.InsufficientBalance)

      expect.assertions(4)
      try {
        await localPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local payment'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          errorToMessage[TransferError.InsufficientBalance]
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('throws InsufficientLiquidityError when liquidity is insufficient', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      jest
        .spyOn(accountingService, 'createTransfer')
        .mockResolvedValueOnce(TransferError.InsufficientLiquidity)

      expect.assertions(4)
      try {
        await localPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local payment'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          errorToMessage[TransferError.InsufficientLiquidity]
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('throws generic error for unknown transfer error', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      jest
        .spyOn(accountingService, 'createTransfer')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce('UnknownError' as any)

      expect.assertions(4)
      try {
        await localPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local payment'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          'Unknown error while trying to create transfer'
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })

    test('throws error when transfer post fails', async (): Promise<void> => {
      const { receiver, outgoingPayment } =
        await createOutgoingPaymentWithReceiver(deps, {
          sendingWalletAddress: walletAddressMap['USD'],
          receivingWalletAddress: walletAddressMap['USD'],
          method: 'ilp',
          quoteOptions: {
            tenantId,
            debitAmount: {
              value: 100n,
              assetScale: walletAddressMap['USD'].asset.scale,
              assetCode: walletAddressMap['USD'].asset.code
            }
          }
        })

      jest.spyOn(accountingService, 'createTransfer').mockResolvedValueOnce({
        post: () => Promise.resolve(TransferError.UnknownTransfer)
      } as Transaction)

      expect.assertions(4)
      try {
        await localPaymentService.pay({
          receiver,
          outgoingPayment,
          finalDebitAmount: 100n,
          finalReceiveAmount: 100n
        })
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentMethodHandlerError)
        expect((err as PaymentMethodHandlerError).message).toBe(
          'Received error during local payment'
        )
        expect((err as PaymentMethodHandlerError).description).toBe(
          errorToMessage[TransferError.UnknownTransfer]
        )
        expect((err as PaymentMethodHandlerError).retryable).toBe(false)
      }
    })
  })
})
