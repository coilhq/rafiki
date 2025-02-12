import assert from 'assert'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

import {
  FundingError,
  LifecycleError,
  OutgoingPaymentError,
  isOutgoingPaymentError
} from './errors'
import { CreateOutgoingPaymentOptions, OutgoingPaymentService } from './service'
import { createTestApp, TestContainer } from '../../../tests/app'
import { Config, IAppConfig } from '../../../config/app'
import { Grant } from '../../auth/middleware'
import { CreateQuoteOptions, QuoteService } from '../../quote/service'
import { createAsset } from '../../../tests/asset'
import { createIncomingPayment } from '../../../tests/incomingPayment'
import { createOutgoingPayment } from '../../../tests/outgoingPayment'
import {
  createWalletAddress,
  MockWalletAddress
} from '../../../tests/walletAddress'
import { createPeer } from '../../../tests/peer'
import { createQuote } from '../../../tests/quote'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../../'
import { AppServices } from '../../../app'
import { truncateTables } from '../../../tests/tableManager'
import {
  OutgoingPayment,
  OutgoingPaymentGrant,
  OutgoingPaymentState,
  PaymentData,
  OutgoingPaymentEvent,
  OutgoingPaymentEventType
} from './model'
import { RETRY_BACKOFF_SECONDS } from './worker'
import { IncomingPayment, IncomingPaymentState } from '../incoming/model'
import { isTransferError } from '../../../accounting/errors'
import { AccountingService } from '../../../accounting/service'
import { AssetOptions } from '../../../asset/service'
import { Amount } from '../../amount'
import { getTests } from '../../wallet_address/model.test'
import { Quote } from '../../quote/model'
import { WalletAddress } from '../../wallet_address/model'
import { PaymentMethodHandlerService } from '../../../payment-method/handler/service'
import { PaymentMethodHandlerError } from '../../../payment-method/handler/errors'
import { mockRatesApi } from '../../../tests/rates'
import { UnionOmit } from '../../../shared/utils'
import { QuoteError } from '../../quote/errors'
import { withConfigOverride } from '../../../tests/helpers'
import { TelemetryService } from '../../../telemetry/service'
import { getPageTests } from '../../../shared/baseModel.test'
import { Pagination, SortOrder } from '../../../shared/baseModel'
import { ReceiverService } from '../../receiver/service'

describe('OutgoingPaymentService', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let outgoingPaymentService: OutgoingPaymentService
  let accountingService: AccountingService
  let paymentMethodHandlerService: PaymentMethodHandlerService
  let quoteService: QuoteService
  let telemetryService: TelemetryService
  let knex: Knex
  let assetId: string
  let walletAddressId: string
  let incomingPayment: IncomingPayment
  let receiverWalletAddress: MockWalletAddress
  let receiver: string
  let client: string
  let amtDelivered: bigint
  let trx: Knex.Transaction
  let config: IAppConfig
  let receiverService: ReceiverService
  let receiverGet: typeof receiverService.get

  const asset: AssetOptions = {
    scale: 9,
    code: 'USD'
  }

  const debitAmount: Amount = {
    value: BigInt(123),
    assetCode: asset.code,
    assetScale: asset.scale
  }

  const destinationAsset = {
    scale: 9,
    code: 'XRP'
  }

  const exchangeRate = 0.5

  const webhookTypes: {
    [key in OutgoingPaymentState]: OutgoingPaymentEventType | undefined
  } = {
    [OutgoingPaymentState.Funding]: OutgoingPaymentEventType.PaymentCreated,
    [OutgoingPaymentState.Sending]: undefined,
    [OutgoingPaymentState.Failed]: OutgoingPaymentEventType.PaymentFailed,
    [OutgoingPaymentState.Completed]: OutgoingPaymentEventType.PaymentCompleted,
    [OutgoingPaymentState.Cancelled]: undefined
  }

  async function processNext(
    paymentId: string,
    expectState: OutgoingPaymentState,
    expectedError?: string
  ): Promise<OutgoingPayment> {
    await expect(outgoingPaymentService.processNext()).resolves.toBe(paymentId)
    const payment = await outgoingPaymentService.get({
      id: paymentId
    })
    if (!payment) throw 'no payment'
    if (expectState) expect(payment.state).toBe(expectState)
    expect(payment.error).toEqual(expectedError || null)
    const type = webhookTypes[payment.state]
    if (type) {
      await expect(
        OutgoingPaymentEvent.query(knex).where({
          type
        })
      ).resolves.not.toHaveLength(0)
    }
    return payment
  }

  async function makeTransfer(args: {
    incomingPayment: IncomingPayment
    receiveAmount: bigint
    outgoingPayment: OutgoingPayment
    debitAmount: bigint
  }): Promise<void> {
    const transfer = await accountingService.createTransfer({
      sourceAccount: args.outgoingPayment,
      destinationAccount: incomingPayment,
      sourceAmount: args.debitAmount,
      destinationAmount: args.receiveAmount,
      timeout: 0
    })

    assert.ok(!isTransferError(transfer))

    await transfer.post()

    amtDelivered += args.receiveAmount
  }

  function mockPaymentHandlerPay(
    outgoingPayment: OutgoingPayment,
    incomingPayment: IncomingPayment,
    error?: PaymentMethodHandlerError
  ) {
    return jest
      .spyOn(paymentMethodHandlerService, 'pay')
      .mockImplementationOnce(async (_, args) => {
        if (error) throw error

        await makeTransfer({
          outgoingPayment,
          incomingPayment,
          debitAmount: args.finalDebitAmount,
          receiveAmount: args.finalReceiveAmount
        })
      })
  }

  // Mock the time to fast-forward to the time that the specified (absolute, not relative) attempt is scheduled.
  function fastForwardToAttempt(stateAttempts: number): void {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(
        Date.now() + stateAttempts * RETRY_BACKOFF_SECONDS * 1000
      )
  }

  async function payIncomingPayment(amount: bigint): Promise<void> {
    await expect(
      accountingService.createDeposit({
        id: uuid(),
        account: incomingPayment,
        amount
      })
    ).resolves.toBeUndefined()
    const totalReceived = await accountingService.getTotalReceived(
      incomingPayment.id
    )
    assert.ok(totalReceived)
    await incomingPayment.onCredit({
      totalReceived
    })
  }

  async function expectOutcome(
    payment: OutgoingPayment,
    {
      amountSent,
      amountDelivered,
      accountBalance,
      incomingPaymentReceived,
      withdrawAmount,
      client
    }: {
      amountSent?: bigint
      amountDelivered?: bigint
      accountBalance?: bigint
      incomingPaymentReceived?: bigint
      withdrawAmount?: bigint
      client?: string
    }
  ) {
    if (amountSent !== undefined) {
      expect(payment.sentAmount.value).toEqual(amountSent)
      await expect(accountingService.getTotalSent(payment.id)).resolves.toBe(
        payment.sentAmount.value
      )
    }

    if (amountDelivered !== undefined) {
      expect(amtDelivered).toEqual(amountDelivered)
    }
    if (accountBalance !== undefined) {
      await expect(accountingService.getBalance(payment.id)).resolves.toEqual(
        accountBalance
      )
    }
    if (incomingPaymentReceived !== undefined) {
      await expect(
        accountingService.getTotalReceived(incomingPayment.id)
      ).resolves.toEqual(incomingPaymentReceived)
    }
    if (withdrawAmount !== undefined && withdrawAmount > 0) {
      await expect(
        OutgoingPaymentEvent.query(knex).where({
          withdrawalAccountId: payment.id,
          withdrawalAmount: withdrawAmount
        })
      ).resolves.toHaveLength(1)
    }
    if (client !== undefined) {
      expect(payment.client).toEqual(client)
    }
  }

  beforeAll(async (): Promise<void> => {
    const exchangeRatesUrl = 'https://test.rates'

    mockRatesApi(exchangeRatesUrl, () => ({
      XRP: exchangeRate
    }))

    deps = await initIocContainer({
      ...Config,
      exchangeRatesUrl,
      enableTelemetry: true,
      localCacheDuration: 0
    })
    appContainer = await createTestApp(deps)
    outgoingPaymentService = await deps.use('outgoingPaymentService')
    accountingService = await deps.use('accountingService')
    paymentMethodHandlerService = await deps.use('paymentMethodHandlerService')
    quoteService = await deps.use('quoteService')
    telemetryService = (await deps.use('telemetry'))!
    config = await deps.use('config')
    knex = appContainer.knex
    receiverService = await deps.use('receiverService')
  })

  beforeEach(async (): Promise<void> => {
    const { id: sendAssetId } = await createAsset(deps, asset)
    assetId = sendAssetId
    const walletAddress = await createWalletAddress(deps, {
      tenantId: config.operatorTenantId,
      assetId: sendAssetId
    })
    walletAddressId = walletAddress.id
    client = walletAddress.url
    const { id: destinationAssetId } = await createAsset(deps, destinationAsset)
    receiverWalletAddress = await createWalletAddress(deps, {
      tenantId: config.operatorTenantId,
      assetId: destinationAssetId,
      mockServerPort: appContainer.openPaymentsPort
    })
    await expect(
      accountingService.createDeposit({
        id: uuid(),
        account: receiverWalletAddress.asset,
        amount: BigInt(123)
      })
    ).resolves.toBeUndefined()

    incomingPayment = await createIncomingPayment(deps, {
      walletAddressId: receiverWalletAddress.id,
      tenantId: Config.operatorTenantId
    })
    receiver = incomingPayment.getUrl(receiverWalletAddress)

    amtDelivered = BigInt(0)

    // Make receivers non-local by default
    receiverGet = receiverService.get
    jest
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
    receiverWalletAddress.scope?.persist(false)
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get/getWalletAddressPage', (): void => {
    getTests({
      createModel: ({ client }) =>
        createOutgoingPayment(deps, {
          walletAddressId,
          client,
          receiver,
          debitAmount,
          validDestination: false,
          method: 'ilp'
        }),
      get: (options) => outgoingPaymentService.get(options),
      list: (options) => outgoingPaymentService.getWalletAddressPage(options)
    })
  })

  describe('get', (): void => {
    test('throws error if cannot find liquidity account for SENDING payment', async () => {
      const quote = await createQuote(deps, {
        walletAddressId,
        receiver,
        debitAmount,
        method: 'ilp'
      })

      const payment = await outgoingPaymentService.create({
        walletAddressId,
        quoteId: quote.id,
        client
      })
      assert.ok(!isOutgoingPaymentError(payment))

      await expect(
        outgoingPaymentService.get({
          id: payment.id,
          client
        })
      ).resolves.toEqual(payment)
      await expect(
        outgoingPaymentService.fund({
          id: payment.id,
          amount: payment.debitAmount.value,
          transferId: uuid()
        })
      ).resolves.toBeDefined()
      jest
        .spyOn(accountingService, 'getTotalSent')
        .mockResolvedValueOnce(undefined)
      await expect(
        outgoingPaymentService.get({
          id: payment.id,
          client
        })
      ).rejects.toThrow(
        'Could not get amount sent for payment. There was a problem getting the associated liquidity account.'
      )
    })
  })

  describe('getPage', (): void => {
    getPageTests({
      createModel: () =>
        createOutgoingPayment(deps, {
          walletAddressId,
          client,
          receiver,
          debitAmount: {
            assetCode: asset.code,
            assetScale: asset.scale,
            value: BigInt(10)
          },
          validDestination: true,
          method: 'ilp'
        }),
      getPage: (pagination?: Pagination, sortOrder?: SortOrder) =>
        outgoingPaymentService.getPage({ pagination, sortOrder })
    })

    describe('filters', () => {
      let otherSenderWalletAddress: WalletAddress
      let otherReceiverWalletAddress: WalletAddress
      let otherReceiver: string
      let outgoingPayment: OutgoingPayment
      let otherOutgoingPayment: OutgoingPayment
      beforeEach(async (): Promise<void> => {
        otherSenderWalletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId,
          assetId
        })
        otherReceiverWalletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId,
          assetId
        })
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: receiverWalletAddress.id,
          tenantId: Config.operatorTenantId
        })
        otherReceiver = incomingPayment.getUrl(otherReceiverWalletAddress)

        outgoingPayment = await createOutgoingPayment(deps, {
          walletAddressId,
          client,
          receiver,
          debitAmount: {
            assetCode: asset.code,
            assetScale: asset.scale,
            value: BigInt(10)
          },
          validDestination: true,
          method: 'ilp'
        })

        otherOutgoingPayment = await createOutgoingPayment(deps, {
          walletAddressId: otherSenderWalletAddress.id,
          client,
          receiver: otherReceiver,
          debitAmount: {
            assetCode: asset.code,
            assetScale: asset.scale,
            value: BigInt(10)
          },
          validDestination: true,
          method: 'ilp'
        })
      })

      test('can filter by receiver', async (): Promise<void> => {
        const page = await outgoingPaymentService.getPage({
          filter: {
            receiver: { in: [receiver] }
          }
        })

        expect(page).toContainEqual(
          expect.objectContaining({ id: outgoingPayment.id })
        )
        expect(page).not.toContainEqual(
          expect.objectContaining({
            id: otherOutgoingPayment.id,
            receiver: otherReceiver
          })
        )
      })

      test('can filter by wallet address', async (): Promise<void> => {
        const page = await outgoingPaymentService.getPage({
          filter: {
            walletAddressId: { in: [walletAddressId] }
          }
        })

        expect(page).toContainEqual(
          expect.objectContaining({ id: outgoingPayment.id, walletAddressId })
        )
        expect(page).not.toContainEqual(
          expect.objectContaining({ id: otherOutgoingPayment.id })
        )
      })

      test('can filter by state', async (): Promise<void> => {
        await OutgoingPayment.query(trx).patchAndFetchById(outgoingPayment.id, {
          state: OutgoingPaymentState.Completed
        })

        const page = await outgoingPaymentService.getPage({
          filter: {
            state: { in: [OutgoingPaymentState.Completed] }
          }
        })

        expect(page).toContainEqual(
          expect.objectContaining({
            id: outgoingPayment.id,
            state: OutgoingPaymentState.Completed
          })
        )
        expect(page).not.toContainEqual(
          expect.objectContaining({ id: otherOutgoingPayment.id })
        )
      })
    })
  })

  describe('getWalletAddressPage', (): void => {
    test('throws error if cannot find liquidity account for SENDING payment', async () => {
      const quote = await createQuote(deps, {
        walletAddressId,
        receiver,
        debitAmount,
        method: 'ilp'
      })

      const payment = await outgoingPaymentService.create({
        walletAddressId,
        client,
        quoteId: quote.id
      })
      assert.ok(!isOutgoingPaymentError(payment))

      await expect(
        outgoingPaymentService.get({
          id: payment.id,
          client
        })
      ).resolves.toEqual(payment)
      await expect(
        outgoingPaymentService.fund({
          id: payment.id,
          amount: payment.debitAmount.value,
          transferId: uuid()
        })
      ).resolves.toBeDefined()
      jest
        .spyOn(accountingService, 'getAccountsTotalSent')
        .mockResolvedValueOnce([undefined])
      await expect(
        outgoingPaymentService.getWalletAddressPage({
          walletAddressId: walletAddressId
        })
      ).rejects.toThrow(
        'Could not get amount sent for payment. There was a problem getting the associated liquidity account.'
      )
    })
  })

  describe('cancel', (): void => {
    const states: [
      string,
      OutgoingPaymentState,
      OutgoingPaymentError | null,
      string | undefined
    ][] = Object.values(OutgoingPaymentState).flatMap((state) => [
      [
        `should ${state == OutgoingPaymentState.Funding ? 'cancel' : 'not cancel'} outgoing payment in ${state} state with reason`,
        state,
        state == OutgoingPaymentState.Funding
          ? null
          : OutgoingPaymentError.WrongState,
        'Not enough balance'
      ],
      [
        `should ${state == OutgoingPaymentState.Funding ? 'cancel' : 'not cancel'} outgoing payment in ${state} state without reason`,
        state,
        state == OutgoingPaymentState.Funding
          ? null
          : OutgoingPaymentError.WrongState,
        undefined
      ]
    ])
    it.each(states)(
      '%s',
      async (_, state, outgoingPaymentError, reason): Promise<void> => {
        /**
         * 1. Create outgoing payment
         * 2. Update the state of outgoing payment
         * 3. Cancel outgoing payment
         * 4. Based on state, check the result
         */
        const outgoingPayment = await createOutgoingPayment(deps, {
          walletAddressId,
          client,
          receiver,
          debitAmount: {
            assetCode: asset.code,
            assetScale: asset.scale,
            value: BigInt(10)
          },
          validDestination: true,
          method: 'ilp'
        })

        await outgoingPayment.$query(knex).patch({ state })

        const response = await outgoingPaymentService.cancel({
          id: outgoingPayment.id,
          reason
        })

        if (!outgoingPaymentError) {
          assert.ok(response instanceof OutgoingPayment)
          expect(response.id).toBe(outgoingPayment.id)
          expect(response.state).toBe(OutgoingPaymentState.Cancelled)
          expect(response.metadata).toEqual({
            cancellationReason: reason
          })
        } else {
          expect(response as OutgoingPaymentError).toBe(outgoingPaymentError)
        }
      }
    )
  })

  describe('create', (): void => {
    enum GrantOption {
      Existing = 'existing',
      New = 'new',
      None = 'no'
    }

    test('create from incoming payment', async () => {
      const walletAddressId = receiverWalletAddress.id
      const incomingPaymentUrl = incomingPayment.toOpenPaymentsTypeWithMethods(
        receiverWalletAddress
      ).id
      const debitAmount = {
        value: BigInt(123),
        assetCode: receiverWalletAddress.asset.code,
        assetScale: receiverWalletAddress.asset.scale
      }

      const quoteSpy = jest.spyOn(quoteService, 'create')

      const payment = await outgoingPaymentService.create({
        walletAddressId,
        debitAmount,
        incomingPayment: incomingPaymentUrl
      })

      expect(!isOutgoingPaymentError(payment)).toBeTruthy()
      expect(quoteSpy).toHaveBeenCalledWith({
        walletAddressId,
        receiver: incomingPaymentUrl,
        debitAmount,
        method: 'ilp'
      })
    })

    test(
      'create many outgoing payments against one grant with debit amount limit',
      withConfigOverride(
        () => config,
        { slippage: 0 },
        async (): Promise<void> => {
          const debitAmount = {
            value: BigInt(10),
            assetCode: receiverWalletAddress.asset.code,
            assetScale: receiverWalletAddress.asset.scale
          }
          const grant: Grant = {
            id: uuid(),
            limits: {
              debitAmount: {
                value: BigInt(Number.MAX_SAFE_INTEGER),
                assetCode: receiverWalletAddress.asset.code,
                assetScale: receiverWalletAddress.asset.scale
              }
            }
          }
          await OutgoingPaymentGrant.query(knex).insertAndFetch({
            id: grant.id
          })

          const options: CreateOutgoingPaymentOptions = {
            walletAddressId: receiverWalletAddress.id,
            debitAmount,
            incomingPayment: incomingPayment.toOpenPaymentsTypeWithMethods(
              receiverWalletAddress
            ).id,
            grant
          }

          for (let i = 0; i < 3; i++) {
            const payment = await outgoingPaymentService.create(options)
            assert.ok(!isOutgoingPaymentError(payment))
            expect(payment.grantSpentDebitAmount?.value ?? 0n).toBe(
              BigInt(debitAmount.value * BigInt(i))
            )
          }
        }
      )
    )

    test(
      'create many outgoing payments against one grant with receive amount limit',
      withConfigOverride(
        () => config,
        { slippage: 0 },
        async (): Promise<void> => {
          const debitAmount = {
            value: BigInt(10),
            assetCode: receiverWalletAddress.asset.code,
            assetScale: receiverWalletAddress.asset.scale
          }
          const grant: Grant = {
            id: uuid(),
            limits: {
              receiveAmount: {
                value: BigInt(Number.MAX_SAFE_INTEGER),
                assetCode: receiverWalletAddress.asset.code,
                assetScale: receiverWalletAddress.asset.scale
              }
            }
          }
          await OutgoingPaymentGrant.query(knex).insertAndFetch({
            id: grant.id
          })

          const options: CreateOutgoingPaymentOptions = {
            walletAddressId: receiverWalletAddress.id,
            debitAmount,
            incomingPayment: incomingPayment.toOpenPaymentsTypeWithMethods(
              receiverWalletAddress
            ).id,
            grant
          }

          for (let i = 0; i < 3; i++) {
            const payment = await outgoingPaymentService.create(options)
            assert.ok(!isOutgoingPaymentError(payment))
            expect(payment.grantSpentReceiveAmount?.value ?? 0n).toBe(
              // Must account for interledger/pay off-by-one issue (even with 0 slippage/fees)
              BigInt((debitAmount.value - BigInt(1)) * BigInt(i))
            )
          }
        }
      )
    )

    test('fails to create quote from incoming payment', async () => {
      const walletAddressId = receiverWalletAddress.id
      const incomingPaymentUrl = incomingPayment.toOpenPaymentsTypeWithMethods(
        receiverWalletAddress
      ).id
      const debitAmount = {
        value: BigInt(123),
        assetCode: receiverWalletAddress.asset.code,
        assetScale: receiverWalletAddress.asset.scale
      }

      const quoteCreateResponse = QuoteError.InvalidAmount
      const quoteSpy = jest
        .spyOn(quoteService, 'create')
        .mockImplementationOnce(async () => quoteCreateResponse)

      const payment = await outgoingPaymentService.create({
        walletAddressId,
        debitAmount,
        incomingPayment: incomingPaymentUrl
      })

      expect(isOutgoingPaymentError(payment)).toBeTruthy()
      expect(payment).toBe(quoteCreateResponse)
      expect(quoteSpy).toHaveBeenCalledWith({
        walletAddressId,
        receiver: incomingPaymentUrl,
        debitAmount,
        method: 'ilp'
      })
    })

    describe.each`
      grantOption
      ${GrantOption.Existing}
      ${GrantOption.New}
      ${GrantOption.None}
    `('$grantOption grant', ({ grantOption }): void => {
      let grant: Grant | undefined
      let client: string | undefined

      beforeEach(async (): Promise<void> => {
        if (grantOption !== GrantOption.None) {
          grant = {
            id: uuid()
          }
          client = faker.internet.url({ appendSlash: false })
          if (grantOption === GrantOption.Existing) {
            await OutgoingPaymentGrant.query(knex).insertAndFetch({
              id: grant.id
            })
          }
        }
      })

      describe('incoming payment receiver', (): void => {
        it.each`
          outgoingPeer | description
          ${false}     | ${''}
          ${true}      | ${'with an outgoing peer'}
        `(
          'creates an OutgoingPayment from a quote $description',
          async ({ outgoingPeer }): Promise<void> => {
            const peerService = await deps.use('peerService')
            const peer = await createPeer(deps)
            const quote = await createQuote(deps, {
              walletAddressId,
              receiver,
              debitAmount,
              method: 'ilp'
            })
            const options = {
              walletAddressId,
              client,
              quoteId: quote.id,
              metadata: {
                description: 'rent',
                externalRef: '202201',
                items: [1, 2, 3]
              }
            }
            if (outgoingPeer) {
              jest
                .spyOn(peerService, 'getByDestinationAddress')
                .mockResolvedValueOnce(peer)
            }
            const payment = await outgoingPaymentService.create(options)
            assert.ok(!isOutgoingPaymentError(payment))
            expect(payment).toMatchObject({
              id: quote.id,
              walletAddressId,
              receiver: quote.receiver,
              debitAmount: quote.debitAmount,
              receiveAmount: quote.receiveAmount,
              metadata: options.metadata,
              state: OutgoingPaymentState.Funding,
              asset: quote.asset,
              peerId: outgoingPeer ? peer.id : null
            })

            await expect(
              outgoingPaymentService.get({
                id: payment.id
              })
            ).resolves.toEqual(payment)

            const expectedPaymentData: Partial<PaymentData> = {
              id: payment.id,
              client: payment.client
            }
            if (outgoingPeer) {
              expectedPaymentData.peerId = peer.id
            }
            await expect(
              OutgoingPaymentEvent.query(knex).where({
                type: OutgoingPaymentEventType.PaymentCreated
              })
            ).resolves.toMatchObject([
              {
                data: expectedPaymentData,
                outgoingPaymentId: payment.id
              }
            ])
          }
        )
      })

      it('fails to create on unknown wallet address', async () => {
        const { id: quoteId } = await createQuote(deps, {
          walletAddressId,
          receiver,
          debitAmount,
          validDestination: false,
          method: 'ilp'
        })
        await expect(
          outgoingPaymentService.create({
            walletAddressId: uuid(),
            quoteId
          })
        ).resolves.toEqual(OutgoingPaymentError.UnknownWalletAddress)
      })

      it('fails to create on unknown quote', async () => {
        await expect(
          outgoingPaymentService.create({
            walletAddressId,
            quoteId: uuid()
          })
        ).resolves.toEqual(OutgoingPaymentError.UnknownQuote)
      })

      it('fails to create on "consumed" quote', async () => {
        const { quote } = await createOutgoingPayment(deps, {
          walletAddressId,
          client,
          receiver,
          validDestination: false,
          method: 'ilp'
        })
        await expect(
          outgoingPaymentService.create({
            walletAddressId,
            client,
            quoteId: quote.id
          })
        ).resolves.toEqual(OutgoingPaymentError.InvalidQuote)
      })

      it('fails to create on invalid quote wallet address', async () => {
        const quote = await createQuote(deps, {
          walletAddressId,
          receiver,
          debitAmount,
          validDestination: false,
          method: 'ilp'
        })
        await expect(
          outgoingPaymentService.create({
            walletAddressId: receiverWalletAddress.id,
            quoteId: quote.id
          })
        ).resolves.toEqual(OutgoingPaymentError.InvalidQuote)
      })

      it('fails to create on expired quote', async () => {
        const quote = await createQuote(deps, {
          walletAddressId,
          receiver,
          debitAmount,
          validDestination: false,
          method: 'ilp'
        })
        await quote.$query(knex).patch({
          expiresAt: new Date()
        })
        await expect(
          outgoingPaymentService.create({
            walletAddressId,
            quoteId: quote.id
          })
        ).resolves.toEqual(OutgoingPaymentError.InvalidQuote)
      })
      it.each`
        state
        ${IncomingPaymentState.Completed}
        ${IncomingPaymentState.Expired}
      `(
        `fails to create on $state quote receiver`,
        async ({ state }): Promise<void> => {
          const quote = await createQuote(deps, {
            walletAddressId,
            receiver,
            debitAmount,
            method: 'ilp'
          })
          await incomingPayment.$query(knex).patch({
            state,
            expiresAt:
              state === IncomingPaymentState.Expired ? new Date() : undefined
          })
          await expect(
            outgoingPaymentService.create({
              walletAddressId,
              quoteId: quote.id
            })
          ).resolves.toEqual(OutgoingPaymentError.InvalidQuote)
        }
      )

      test('fails to create on inactive wallet address', async () => {
        const { id: quoteId } = await createQuote(deps, {
          walletAddressId,
          receiver,
          debitAmount,
          validDestination: false,
          method: 'ilp'
        })
        const walletAddress = await createWalletAddress(deps, {
          tenantId: config.operatorTenantId
        })
        const walletAddressUpdated = await WalletAddress.query(
          knex
        ).patchAndFetchById(walletAddress.id, { deactivatedAt: new Date() })
        assert.ok(!walletAddressUpdated.isActive)
        await expect(
          outgoingPaymentService.create({
            walletAddressId: walletAddress.id,
            quoteId
          })
        ).resolves.toEqual(OutgoingPaymentError.InactiveWalletAddress)
      })

      if (grantOption !== GrantOption.None) {
        test('fails to create if grant is locked', async () => {
          assert.ok(grant)
          grant.limits = {
            receiver,
            debitAmount
          }
          const quotes = await Promise.all(
            [0, 1].map(async (_) => {
              return await createQuote(deps, {
                walletAddressId,
                receiver,
                debitAmount,
                method: 'ilp'
              })
            })
          )
          const options = quotes.map((quote) => {
            return {
              walletAddressId,
              client,
              quoteId: quote.id,
              metadata: {
                description: 'rent',
                externalRef: '202201'
              },
              grant,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (f: any) => setTimeout(f, 20),
              grantLockTimeoutMs: 20
            }
          })

          if (grantOption === GrantOption.Existing) {
            await expect(
              Promise.all(
                options.map(async (option) => {
                  return await outgoingPaymentService.create(option)
                })
              )
            ).rejects.toThrowError(
              'Defined query timeout of 20ms exceeded when running query.'
            )
          } else {
            await Promise.all(
              options.map(async (option) => {
                return await outgoingPaymentService.create(option)
              })
            )
          }
          const payments = await OutgoingPayment.query(trx)
          expect(payments.length).toEqual(1)
          expect([quotes[0].id, quotes[1].id]).toContain(payments[0].id)
        })

        describe('validateGrant', (): void => {
          let quote: Quote
          let options: UnionOmit<CreateOutgoingPaymentOptions, 'grant'>
          let interval: string
          beforeEach(async (): Promise<void> => {
            quote = await createQuote(deps, {
              walletAddressId,
              receiver,
              debitAmount,
              method: 'ilp'
            })
            options = {
              walletAddressId,
              quoteId: quote.id,
              metadata: {
                description: 'rent',
                externalRef: '202201'
              },
              client
            }
            const start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            interval = `R0/${start.toISOString()}/P1M`
          })
          test('fails if grant limits interval does not cover now', async (): Promise<void> => {
            const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
            assert.ok(grant)
            grant.limits = {
              debitAmount: debitAmount,
              interval: `R0/${start.toISOString()}/P1M`
            }
            await expect(
              outgoingPaymentService.create({ ...options, grant })
            ).resolves.toEqual(OutgoingPaymentError.InsufficientGrant)
          })
          test('succeeds if grant limit receiver matches payment receiver', async (): Promise<void> => {
            assert.ok(grant)
            grant.limits = {
              ...grant.limits,
              receiver
            }
            const quote = await createQuote(deps, {
              walletAddressId,
              receiver,
              debitAmount,
              validDestination: false,
              method: 'ilp'
            })
            await expect(
              outgoingPaymentService.create({
                ...options,
                grant,
                quoteId: quote.id
              })
            ).resolves.toBeInstanceOf(OutgoingPayment)
          })
          test('fails if grant limit receiver does not match payment receiver', async (): Promise<void> => {
            assert.ok(grant)
            grant.limits = {
              ...grant.limits,
              receiver: 'http://another.wallet/address'
            }
            await expect(
              outgoingPaymentService.create({ ...options, grant })
            ).resolves.toEqual(OutgoingPaymentError.InsufficientGrant)
          })
          test.each`
            limits                                                                         | description
            ${{ debitAmount: { assetCode: 'EUR', assetScale: asset.scale } }}              | ${'debitAmount asset code'}
            ${{ debitAmount: { assetCode: asset.code, assetScale: 2 } }}                   | ${'debitAmount asset scale'}
            ${{ receiveAmount: { assetCode: 'EUR', assetScale: destinationAsset.scale } }} | ${'receiveAmount asset code'}
            ${{ receiveAmount: { assetCode: destinationAsset.code, assetScale: 2 } }}      | ${'receiveAmount asset scale'}
          `(
            'fails if grant limits do not match payment - $description',
            async ({ limits }): Promise<void> => {
              assert.ok(grant)
              grant.limits = { ...limits, interval }
              await expect(
                outgoingPaymentService.create({ ...options, grant })
              ).resolves.toEqual(OutgoingPaymentError.InsufficientGrant)
            }
          )
          test.each`
            debitAmount | description
            ${true}     | ${'debitAmount'}
            ${false}    | ${'receiveAmount'}
          `(
            'fails if grant limit $description is not enough for payment',
            async ({ debitAmount }): Promise<void> => {
              const amount = {
                value: BigInt(12),
                assetCode: debitAmount
                  ? quote.asset.code
                  : quote.receiveAmount.assetCode,
                assetScale: debitAmount
                  ? quote.asset.scale
                  : quote.receiveAmount.assetScale
              }
              assert.ok(grant)
              grant.limits = debitAmount
                ? {
                    debitAmount: amount,
                    interval
                  }
                : {
                    receiveAmount: amount,
                    interval
                  }
              await expect(
                outgoingPaymentService.create({ ...options, grant })
              ).resolves.toEqual(OutgoingPaymentError.InsufficientGrant)
            }
          )
          test.each`
            debitAmount | failed   | description
            ${true}     | ${false} | ${'debitAmount'}
            ${false}    | ${false} | ${'receiveAmount'}
            ${true}     | ${true}  | ${'debitAmount, failed first payment'}
            ${false}    | ${true}  | ${'receiveAmount, failed first payment'}
          `(
            'fails if limit was already used up - $description',
            async ({ debitAmount, failed }): Promise<void> => {
              const grantAmount = {
                value: BigInt(200),
                assetCode: debitAmount
                  ? quote.asset.code
                  : quote.receiveAmount.assetCode,
                assetScale: debitAmount
                  ? quote.asset.scale
                  : quote.receiveAmount.assetScale
              }
              assert.ok(grant)
              grant.limits = {
                debitAmount: debitAmount ? grantAmount : undefined,
                receiveAmount: debitAmount ? undefined : grantAmount,
                interval
              }
              const paymentAmount = {
                ...grantAmount,
                value: BigInt(190)
              }
              const firstPayment = await createOutgoingPayment(deps, {
                walletAddressId,
                client,
                receiver: `${
                  Config.openPaymentsUrl
                }/incoming-payments/${uuid()}`,
                debitAmount: debitAmount ? paymentAmount : undefined,
                receiveAmount: debitAmount ? undefined : paymentAmount,
                grant,
                validDestination: false,
                method: 'ilp'
              })
              assert.ok(firstPayment)
              if (failed) {
                await firstPayment
                  .$query(trx)
                  .patch({ state: OutgoingPaymentState.Failed })

                jest
                  .spyOn(accountingService, 'getTotalSent')
                  .mockResolvedValueOnce(
                    debitAmount ? BigInt(188) : BigInt(188 * 2)
                  )
              }

              await expect(
                outgoingPaymentService.create({ ...options, grant })
              ).resolves.toEqual(OutgoingPaymentError.InsufficientGrant)
            }
          )
          test.each`
            limits          | description
            ${undefined}    | ${'has no limits'}
            ${{ receiver }} | ${'limits do not specify send or receive amount'}
          `(
            'succeeds if grant access $description',
            async ({ limits }): Promise<void> => {
              assert.ok(grant)
              grant.limits = limits
              await expect(
                outgoingPaymentService.create({ ...options, grant })
              ).resolves.toBeInstanceOf(OutgoingPayment)
            }
          )

          test.each`
            debitAmount | competingPayment | failed       | half     | description
            ${true}     | ${false}         | ${undefined} | ${false} | ${'debitAmount w/o competing payment'}
            ${false}    | ${false}         | ${undefined} | ${false} | ${'receiveAmount w/o competing payment'}
            ${true}     | ${true}          | ${false}     | ${false} | ${'debitAmount w/ competing payment'}
            ${false}    | ${true}          | ${false}     | ${false} | ${'receiveAmount w/ competing payment'}
            ${true}     | ${true}          | ${true}      | ${false} | ${'debitAmount w/ failed competing payment'}
            ${false}    | ${true}          | ${true}      | ${false} | ${'receiveAmount w/ failed competing payment'}
            ${true}     | ${true}          | ${true}      | ${true}  | ${'debitAmount w/ half-way failed competing payment'}
            ${false}    | ${true}          | ${true}      | ${true}  | ${'receiveAmount half-way w/ failed competing payment'}
          `(
            'succeeds if grant limit is enough for payment - $description',
            async ({
              debitAmount,
              competingPayment,
              failed,
              half
            }): Promise<void> => {
              const grantAmount = {
                value: BigInt(1234567),
                assetCode: debitAmount
                  ? quote.asset.code
                  : quote.receiveAmount.assetCode,
                assetScale: debitAmount
                  ? quote.asset.scale
                  : quote.receiveAmount.assetScale
              }
              assert.ok(grant)
              grant.limits = debitAmount
                ? {
                    debitAmount: grantAmount,
                    interval
                  }
                : {
                    receiveAmount: grantAmount,
                    interval
                  }
              if (competingPayment) {
                const paymentAmount = {
                  ...grantAmount,
                  value: BigInt(7)
                }
                const firstPayment = await createOutgoingPayment(deps, {
                  walletAddressId,
                  client,
                  receiver: `${
                    Config.openPaymentsUrl
                  }/incoming-payments/${uuid()}`,
                  debitAmount: debitAmount ? paymentAmount : undefined,
                  receiveAmount: debitAmount ? undefined : paymentAmount,
                  grant,
                  validDestination: false,
                  method: 'ilp'
                })
                assert.ok(firstPayment)
                if (failed) {
                  await firstPayment
                    .$query(trx)
                    .patch({ state: OutgoingPaymentState.Failed })
                  if (half) {
                    jest
                      .spyOn(accountingService, 'getTotalSent')
                      .mockResolvedValueOnce(BigInt(100))
                  }
                }
              }
              await expect(
                outgoingPaymentService.create({ ...options, grant })
              ).resolves.toBeInstanceOf(OutgoingPayment)
            }
          )
        })
      }
    })
  })

  describe('processNext', (): void => {
    const receiveAmount = {
      value: BigInt(123),
      assetCode: destinationAsset.code,
      assetScale: destinationAsset.scale
    }

    async function setup(
      opts: Omit<CreateQuoteOptions, 'walletAddressId'>,
      incomingAmount?: Amount
    ): Promise<OutgoingPayment> {
      if (incomingAmount) {
        await incomingPayment.$query(knex).patch({ incomingAmount })
      }
      const payment = await createOutgoingPayment(deps, {
        walletAddressId,
        client,
        ...opts
      })

      await expect(
        outgoingPaymentService.fund({
          id: payment.id,
          amount: payment.debitAmount.value,
          transferId: uuid()
        })
      ).resolves.toMatchObject({
        state: OutgoingPaymentState.Sending
      })

      return payment
    }

    test('Telemetry Transaction Counter increments for COMPLETED transactions', async (): Promise<void> => {
      const incrementTrxCounterSpy = jest
        .spyOn(telemetryService!, 'incrementCounter')
        .mockImplementation(() => Promise.resolve())

      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: receiverWalletAddress.id,
        incomingAmount: {
          value: receiveAmount.value,
          assetCode: receiverWalletAddress.asset.code,
          assetScale: receiverWalletAddress.asset.scale
        },
        tenantId: Config.operatorTenantId
      })
      assert.ok(incomingPayment.walletAddress)

      const createdPayment = await setup({
        receiver: incomingPayment.getUrl(incomingPayment.walletAddress),
        receiveAmount,
        method: 'ilp'
      })

      mockPaymentHandlerPay(createdPayment, incomingPayment)
      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )
      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value,
        incomingPaymentReceived: payment.receiveAmount.value,
        withdrawAmount: 0n
      })

      expect(incrementTrxCounterSpy).toHaveBeenCalledWith(
        'transactions_total',
        1,
        {
          description: 'Count of funded transactions'
        }
      )
    })

    test('Telemetry Transaction Counter does not increments for FAILED transactions', async (): Promise<void> => {
      const incrementTrxCounterSpy = jest
        .spyOn(telemetryService!, 'incrementCounter')
        .mockImplementation(() => Promise.resolve())
      const createdPayment = await setup({
        receiver,
        debitAmount,
        method: 'ilp'
      })

      mockPaymentHandlerPay(
        createdPayment,
        incomingPayment,
        new PaymentMethodHandlerError('Failed payment', {
          description: '',
          retryable: false
        })
      )

      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Failed,
        'Failed payment'
      )

      await expectOutcome(payment, {
        accountBalance: payment.debitAmount.value,
        amountSent: 0n,
        amountDelivered: 0n,
        incomingPaymentReceived: incomingPayment.receivedAmount.value,
        withdrawAmount: 0n
      })

      expect(incrementTrxCounterSpy).not.toHaveBeenCalled()
    })

    test('COMPLETED with Telemetry Fee Counter (receiveAmount < incomingPayment.incomingAmount)', async (): Promise<void> => {
      const spyTelFeeAmount = jest.spyOn(
        telemetryService,
        'incrementCounterWithTransactionAmountDifference'
      )
      const spyCounter = jest.spyOn(telemetryService, 'incrementCounter')

      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: receiverWalletAddress.id,
        incomingAmount: {
          value: receiveAmount.value * 2n,
          assetCode: receiverWalletAddress.asset.code,
          assetScale: receiverWalletAddress.asset.scale
        },
        tenantId: Config.operatorTenantId
      })
      assert.ok(incomingPayment.walletAddress)

      const createdPayment = await setup({
        receiver: incomingPayment.getUrl(incomingPayment.walletAddress),
        receiveAmount,
        method: 'ilp'
      })

      mockPaymentHandlerPay(createdPayment, incomingPayment)
      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )
      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value,
        incomingPaymentReceived: payment.receiveAmount.value,
        withdrawAmount: 0n
      })
      // [incrementCounterWithTransactionAmountDifference] called and [incrementCounter] only once due to [Count of funded transactions]
      expect(spyTelFeeAmount).toHaveBeenCalledTimes(1)
      expect(spyCounter).toHaveBeenCalledTimes(1)
      expect(spyCounter).toHaveBeenCalledTimes(1)
    })

    test.each`
      debitAmount    | receiveAmount
      ${debitAmount} | ${undefined}
      ${undefined}   | ${receiveAmount}
    `('COMPLETED', async ({ debitAmount, receiveAmount }): Promise<void> => {
      const spyTelFeeAmount = jest.spyOn(
        telemetryService,
        'incrementCounterWithTransactionAmountDifference'
      )
      const spyCounter = jest.spyOn(telemetryService, 'incrementCounter')

      const createdPayment = await setup({
        receiver,
        debitAmount,
        receiveAmount,
        method: 'ilp'
      })

      mockPaymentHandlerPay(createdPayment, incomingPayment)

      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )
      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value,
        incomingPaymentReceived: payment.receiveAmount.value,
        withdrawAmount: 0n
      })
      expect(spyTelFeeAmount).toHaveBeenCalledTimes(1)
      expect(spyCounter).toHaveBeenCalledTimes(1)
    })

    test('COMPLETED (receiveAmount < incomingPayment.incomingAmount)', async (): Promise<void> => {
      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: receiverWalletAddress.id,
        incomingAmount: {
          value: receiveAmount.value * 2n,
          assetCode: receiverWalletAddress.asset.code,
          assetScale: receiverWalletAddress.asset.scale
        },
        tenantId: Config.operatorTenantId
      })
      assert.ok(incomingPayment.id)
      assert.ok(incomingPayment.createdAt)
      assert.ok(incomingPayment.updatedAt)
      assert.ok(incomingPayment.expiresAt)
      assert.ok(incomingPayment.processAt)
      assert.ok(incomingPayment.assetId)
      assert.ok(incomingPayment.asset)
      assert.ok(incomingPayment.asset.code)
      assert.ok(incomingPayment.asset.scale)
      assert.ok(incomingPayment.asset.createdAt)
      assert.ok(incomingPayment.walletAddressId)
      assert.ok(incomingPayment.walletAddress)
      expect(incomingPayment.state).toEqual('PENDING')
      expect(incomingPayment.incomingAmount?.value).toBeGreaterThan(0n)
      assert.ok(incomingPayment.incomingAmount?.assetCode)
      assert.ok(incomingPayment.incomingAmount?.assetScale)
      expect(incomingPayment.receivedAmount.value).toEqual(0n)
      assert.ok(incomingPayment.receivedAmount?.assetCode)
      assert.ok(incomingPayment.receivedAmount?.assetScale)

      const createdPayment = await setup({
        receiver: incomingPayment.getUrl(incomingPayment.walletAddress),
        receiveAmount,
        method: 'ilp'
      })

      mockPaymentHandlerPay(createdPayment, incomingPayment)
      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )
      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value,
        incomingPaymentReceived: payment.receiveAmount.value,
        withdrawAmount: 0n
      })
    })

    test('COMPLETED (with incoming payment initially partially paid)', async (): Promise<void> => {
      const createdPayment = await setup(
        {
          receiver,
          receiveAmount,
          method: 'ilp'
        },
        receiveAmount
      )

      const amountAlreadyDelivered = BigInt(34)
      await payIncomingPayment(amountAlreadyDelivered)

      mockPaymentHandlerPay(createdPayment, incomingPayment)

      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )
      // The amountAlreadyDelivered is unknown to the sender when sending to
      // the connection (instead of the incoming payment), so the entire
      // receive amount is delivered by the outgoing payment ("overpaying"
      // the incoming payment).
      // Incoming payments allow overpayment (above the incomingAmount) for
      // one packet. In this case, the full payment amount was completed in a
      // single packet. With a different combination of amounts and
      // maxPacketAmount limits, an outgoing payment to a connection could
      // overpay the corresponding incoming payment's incomingAmount without
      // the full outgoing payment receive amount being delivered.
      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value - amountAlreadyDelivered,
        incomingPaymentReceived: payment.receiveAmount.value,
        withdrawAmount: 0n
      })
    })

    test('SENDING -> FAILED (partial payment then retryable Pay error)', async (): Promise<void> => {
      const createdPayment = await setup({
        receiver,
        debitAmount,
        method: 'ilp'
      })

      await makeTransfer({
        incomingPayment,
        receiveAmount: 5n,
        outgoingPayment: createdPayment,
        debitAmount: 10n
      })

      const retryableError = new PaymentMethodHandlerError('Failed payment', {
        description: '',
        retryable: true
      })

      for (let i = 0; i < 4; i++) {
        mockPaymentHandlerPay(createdPayment, incomingPayment, retryableError)

        const payment = await processNext(
          createdPayment.id,
          OutgoingPaymentState.Sending
        )
        expect(payment.stateAttempts).toBe(i + 1)
        // Skip through the backoff timer.
        fastForwardToAttempt(payment.stateAttempts)
      }

      mockPaymentHandlerPay(createdPayment, incomingPayment, retryableError)

      // Last attempt fails, but no more retries.
      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Failed,
        retryableError.message
      )

      expect(payment.stateAttempts).toBe(0)
      await expectOutcome(payment, {
        accountBalance: payment.debitAmount.value - 10n,
        amountSent: 10n,
        amountDelivered: 5n,
        incomingPaymentReceived: 5n,
        withdrawAmount: payment.debitAmount.value - 10n
      })
    })

    test('FAILED (non-retryable error)', async (): Promise<void> => {
      const createdPayment = await setup({
        receiver,
        debitAmount,
        method: 'ilp'
      })

      mockPaymentHandlerPay(
        createdPayment,
        incomingPayment,
        new PaymentMethodHandlerError('Failed payment', {
          description: '',
          retryable: false
        })
      )

      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Failed,
        'Failed payment'
      )

      await expectOutcome(payment, {
        accountBalance: payment.debitAmount.value,
        amountSent: 0n,
        amountDelivered: 0n,
        incomingPaymentReceived: incomingPayment.receivedAmount.value,
        withdrawAmount: 0n
      })
    })

    test('SENDING→COMPLETED (partial payment, resume, complete)', async (): Promise<void> => {
      const createdPayment = await setup({
        receiver,
        receiveAmount,
        method: 'ilp'
      })

      await makeTransfer({
        incomingPayment,
        receiveAmount: 5n,
        outgoingPayment: createdPayment,
        debitAmount: 10n
      })

      mockPaymentHandlerPay(createdPayment, incomingPayment)

      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )

      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value,
        incomingPaymentReceived: payment.receiveAmount.value
      })
    })

    // Caused by retry after failed SENDING→COMPLETED transition commit.
    test('COMPLETED (already fully paid)', async (): Promise<void> => {
      const createdPayment = await setup(
        {
          receiver,
          receiveAmount,
          method: 'ilp'
        },
        receiveAmount
      )

      mockPaymentHandlerPay(createdPayment, incomingPayment)

      await processNext(createdPayment.id, OutgoingPaymentState.Completed)
      // Pretend that the transaction didn't commit.
      await OutgoingPayment.query(knex)
        .findById(createdPayment.id)
        .patch({ state: OutgoingPaymentState.Sending })

      mockPaymentHandlerPay(createdPayment, incomingPayment)
      const payment = await processNext(
        createdPayment.id,
        OutgoingPaymentState.Completed
      )
      await expectOutcome(payment, {
        accountBalance: 0n,
        amountSent: payment.debitAmount.value,
        amountDelivered: payment.receiveAmount.value,
        incomingPaymentReceived: payment.receiveAmount.value
      })
    })

    test('COMPLETED (already fully paid)', async (): Promise<void> => {
      const { id: paymentId } = await setup(
        {
          receiver,
          receiveAmount,
          method: 'ilp'
        },
        receiveAmount
      )
      // The quote thinks there's a full amount to pay, but actually sending will find the incoming payment has been paid (e.g. by another payment).
      await payIncomingPayment(receiveAmount.value)

      const payment = await processNext(
        paymentId,
        OutgoingPaymentState.Completed
      )
      await expectOutcome(payment, {
        accountBalance: payment.debitAmount.value,
        amountSent: BigInt(0),
        amountDelivered: BigInt(0),
        incomingPaymentReceived: receiveAmount.value,
        withdrawAmount: payment.debitAmount.value
      })
    })

    test('FAILED (source asset changed)', async (): Promise<void> => {
      const { id: paymentId } = await setup(
        {
          receiver,
          receiveAmount,
          method: 'ilp'
        },
        receiveAmount
      )

      const { id: assetId } = await createAsset(deps, {
        code: asset.code,
        scale: asset.scale + 1
      })

      await OutgoingPayment.relatedQuery('walletAddress').for(paymentId).patch({
        assetId
      })

      await processNext(
        paymentId,
        OutgoingPaymentState.Failed,
        LifecycleError.SourceAssetConflict
      )
    })
    test('FAILED (destination asset changed)', async (): Promise<void> => {
      const createdPayment = await setup({
        receiver,
        debitAmount,
        method: 'ilp'
      })

      // Pretend that the destination asset was initially different.
      await OutgoingPayment.relatedQuery('quote')
        .for(createdPayment.id)
        .patch({
          receiveAmount: {
            ...receiveAmount,
            assetScale: 55
          }
        })
      await processNext(
        createdPayment.id,
        OutgoingPaymentState.Failed,
        LifecycleError.DestinationAssetConflict
      )
    })
  })

  describe('fund', (): void => {
    let payment: OutgoingPayment
    let quoteAmount: bigint

    beforeEach(async (): Promise<void> => {
      payment = await createOutgoingPayment(deps, {
        walletAddressId,
        receiver,
        debitAmount,
        validDestination: false,
        method: 'ilp',
        client
      })
      quoteAmount = payment.debitAmount.value
      await expectOutcome(payment, {
        accountBalance: BigInt(0),
        client
      })
    }, 10_000)

    it('fails when no payment exists', async (): Promise<void> => {
      await expect(
        outgoingPaymentService.fund({
          id: uuid(),
          amount: quoteAmount,
          transferId: uuid()
        })
      ).resolves.toEqual(FundingError.UnknownPayment)
    })

    it('transitions a Funding payment to Sending state', async (): Promise<void> => {
      await expect(
        outgoingPaymentService.fund({
          id: payment.id,
          amount: quoteAmount,
          transferId: uuid()
        })
      ).resolves.toMatchObject({
        id: payment.id,
        state: OutgoingPaymentState.Sending
      })

      const after = await outgoingPaymentService.get({
        id: payment.id
      })
      expect(after?.state).toBe(OutgoingPaymentState.Sending)
      await expectOutcome(payment, { accountBalance: quoteAmount })
    })

    it('fails for invalid funding amount', async (): Promise<void> => {
      await expect(
        outgoingPaymentService.fund({
          id: payment.id,
          amount: quoteAmount - BigInt(1),
          transferId: uuid()
        })
      ).resolves.toEqual(FundingError.InvalidAmount)

      const after = await outgoingPaymentService.get({
        id: payment.id
      })
      expect(after?.state).toBe(OutgoingPaymentState.Funding)
      await expectOutcome(payment, { accountBalance: BigInt(0) })
    })

    Object.values(OutgoingPaymentState).forEach((startState) => {
      if (startState === OutgoingPaymentState.Funding) return
      it(`does not fund a ${startState} payment`, async (): Promise<void> => {
        await payment.$query().patch({ state: startState })
        await expect(
          outgoingPaymentService.fund({
            id: payment.id,
            amount: quoteAmount,
            transferId: uuid()
          })
        ).resolves.toEqual(FundingError.WrongState)

        const after = await outgoingPaymentService.get({
          id: payment.id
        })
        expect(after?.state).toBe(startState)
      })
    })
  })
})
