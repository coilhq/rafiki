import assert from 'assert'
import { C9_CONFIG, HLB_CONFIG } from './lib/config'
import { MockASE } from './lib/mock-ase'
import { Fee, WebhookEventType } from 'mock-account-service-lib'
import { poll } from './lib/utils'
import { TestActions, createTestActions } from './lib/test-actions'

jest.setTimeout(20_000)

describe('Integration tests', (): void => {
  let c9: MockASE
  let hlb: MockASE
  let testActions: TestActions

  beforeAll(async () => {
    try {
      c9 = await MockASE.create(C9_CONFIG)
      hlb = await MockASE.create(HLB_CONFIG)
    } catch (e) {
      console.error(e)
      // Prevents jest from running all tests, which obfuscates errors in beforeAll
      // https://github.com/jestjs/jest/issues/2713
      process.exit(1)
    }

    testActions = createTestActions({ sendingASE: c9, receivingASE: hlb })
  })

  afterAll(async () => {
    c9.shutdown()
    hlb.shutdown()
  })

  // Individual requests
  describe('Requests', (): void => {
    test('Can Get Non-Existing Wallet Address', async (): Promise<void> => {
      const notFoundWalletAddress =
        'https://happy-life-bank-test-backend:4100/accounts/asmith'

      const handleWebhookEventSpy = jest.spyOn(
        hlb.integrationServer.webhookEventHandler,
        'handleWebhookEvent'
      )

      // Poll in case the webhook response to create wallet address is slow,
      // but initial request may very well resolve immediately.
      const walletAddress = await poll(
        async () =>
          c9.opClient.walletAddress.get({
            url: notFoundWalletAddress
          }),
        (responseData) => responseData.id === notFoundWalletAddress,
        5,
        0.5
      )

      assert(walletAddress)
      expect(walletAddress.id).toBe(notFoundWalletAddress)
      expect(handleWebhookEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebhookEventType.WalletAddressNotFound,
          data: expect.objectContaining({
            walletAddressUrl: notFoundWalletAddress
          })
        })
      )
    })
  })

  // Series of requests depending on eachother
  describe('Flows', () => {
    test('Open Payments with Continuation via Polling', async (): Promise<void> => {
      const {
        grantRequestIncomingPayment,
        createIncomingPayment,
        grantRequestQuote,
        createQuote,
        grantRequestOutgoingPayment,
        pollGrantContinue,
        createOutgoingPayment,
        getOutgoingPayment,
        getPublicIncomingPayment
      } = testActions.openPayments
      const { consentInteraction } = testActions

      const receiverWalletAddressUrl =
        'https://happy-life-bank-test-backend:4100/accounts/pfry'
      const senderWalletAddressUrl =
        'https://cloud-nine-wallet-test-backend:3100/accounts/gfranklin'
      const amountValueToSend = '100'

      const receiverWalletAddress = await c9.opClient.walletAddress.get({
        url: receiverWalletAddressUrl
      })
      expect(receiverWalletAddress.id).toBe(receiverWalletAddressUrl)

      const senderWalletAddress = await c9.opClient.walletAddress.get({
        url: senderWalletAddressUrl
      })
      expect(senderWalletAddress.id).toBe(senderWalletAddressUrl)

      const incomingPaymentGrant = await grantRequestIncomingPayment(
        receiverWalletAddress
      )
      const incomingPayment = await createIncomingPayment(
        receiverWalletAddress,
        amountValueToSend,
        incomingPaymentGrant.access_token.value
      )
      const quoteGrant = await grantRequestQuote(senderWalletAddress)
      const quote = await createQuote(
        senderWalletAddress,
        quoteGrant.access_token.value,
        incomingPayment
      )
      const outgoingPaymentGrant = await grantRequestOutgoingPayment(
        senderWalletAddress,
        quote
      )
      await consentInteraction(outgoingPaymentGrant, senderWalletAddress)
      const grantContinue = await pollGrantContinue(outgoingPaymentGrant)
      const outgoingPayment = await createOutgoingPayment(
        senderWalletAddress,
        grantContinue,
        quote
      )
      await getOutgoingPayment(
        outgoingPayment.id,
        grantContinue,
        amountValueToSend
      )
      await getPublicIncomingPayment(incomingPayment.id, amountValueToSend)

      const incomingPayment_ = await hlb.opClient.incomingPayment.getPublic({
        url: incomingPayment.id
      })
      assert(incomingPayment_.receivedAmount)
      expect(incomingPayment_.receivedAmount.value).toBe(amountValueToSend)
    })
    test('Open Payments with Continuation via finish method', async (): Promise<void> => {
      const {
        grantRequestIncomingPayment,
        createIncomingPayment,
        grantRequestQuote,
        createQuote,
        grantRequestOutgoingPayment,
        grantContinue,
        createOutgoingPayment,
        getOutgoingPayment,
        getPublicIncomingPayment
      } = testActions.openPayments
      const { consentInteractionWithInteractRef } = testActions

      const receiverWalletAddressUrl =
        'https://happy-life-bank-test-backend:4100/accounts/pfry'
      const senderWalletAddressUrl =
        'https://cloud-nine-wallet-test-backend:3100/accounts/gfranklin'
      const amountValueToSend = '100'

      const receiverWalletAddress = await c9.opClient.walletAddress.get({
        url: receiverWalletAddressUrl
      })
      expect(receiverWalletAddress.id).toBe(receiverWalletAddressUrl)

      const senderWalletAddress = await c9.opClient.walletAddress.get({
        url: senderWalletAddressUrl
      })
      expect(senderWalletAddress.id).toBe(senderWalletAddressUrl)

      const incomingPaymentGrant = await grantRequestIncomingPayment(
        receiverWalletAddress
      )
      const incomingPayment = await createIncomingPayment(
        receiverWalletAddress,
        amountValueToSend,
        incomingPaymentGrant.access_token.value
      )
      const quoteGrant = await grantRequestQuote(senderWalletAddress)
      const quote = await createQuote(
        senderWalletAddress,
        quoteGrant.access_token.value,
        incomingPayment
      )
      const outgoingPaymentGrant = await grantRequestOutgoingPayment(
        senderWalletAddress,
        quote,
        {
          method: 'redirect',
          uri: 'https://example.com',
          nonce: '456'
        }
      )
      const interactRef = await consentInteractionWithInteractRef(
        outgoingPaymentGrant,
        senderWalletAddress
      )
      const finalizedGrant = await grantContinue(
        outgoingPaymentGrant,
        interactRef
      )
      const outgoingPayment = await createOutgoingPayment(
        senderWalletAddress,
        finalizedGrant,
        quote
      )
      await getOutgoingPayment(
        outgoingPayment.id,
        finalizedGrant,
        amountValueToSend
      )
      await getPublicIncomingPayment(incomingPayment.id, amountValueToSend)
    })
    test('Peer to Peer', async (): Promise<void> => {
      const {
        createReceiver,
        createQuote,
        createOutgoingPayment,
        getOutgoingPayment
      } = testActions.admin

      const senderWalletAddress = await c9.accounts.getByWalletAddressUrl(
        'https://cloud-nine-wallet-test-backend:3100/accounts/gfranklin'
      )
      assert(senderWalletAddress?.walletAddressID)
      const senderWalletAddressId = senderWalletAddress.walletAddressID
      const value = '500'
      const createReceiverInput = {
        metadata: {
          description: 'For lunch!'
        },
        incomingAmount: {
          assetCode: 'USD',
          assetScale: 2,
          value: value as unknown as bigint
        },
        walletAddressUrl:
          'https://happy-life-bank-test-backend:4100/accounts/pfry'
      }

      const receiver = await createReceiver(createReceiverInput)
      const quote = await createQuote(senderWalletAddressId, receiver)
      const outgoingPayment = await createOutgoingPayment(
        senderWalletAddressId,
        quote
      )
      const outgoingPayment_ = await getOutgoingPayment(
        outgoingPayment.id,
        value
      )
      expect(outgoingPayment_.sentAmount.value).toBe(BigInt(value))
    })
    test('Peer to Peer - Cross Currency', async (): Promise<void> => {
      const {
        createReceiver,
        createQuote,
        createOutgoingPayment,
        getOutgoingPayment
      } = testActions.admin

      const senderWalletAddress = await c9.accounts.getByWalletAddressUrl(
        'https://cloud-nine-wallet-test-backend:3100/accounts/gfranklin'
      )
      assert(senderWalletAddress)
      const senderAssetCode = senderWalletAddress.assetCode
      const senderWalletAddressId = senderWalletAddress.walletAddressID
      const value = '500'
      const createReceiverInput = {
        metadata: {
          description: 'cross-currency'
        },
        incomingAmount: {
          assetCode: 'EUR',
          assetScale: 2,
          value: value as unknown as bigint
        },
        walletAddressUrl:
          'https://happy-life-bank-test-backend:4100/accounts/lars'
      }

      const receiver = await createReceiver(createReceiverInput)
      assert(receiver.incomingAmount)

      const quote = await createQuote(senderWalletAddressId, receiver)
      const outgoingPayment = await createOutgoingPayment(
        senderWalletAddressId,
        quote
      )
      const payment = await getOutgoingPayment(outgoingPayment.id, value)

      const receiverAssetCode = receiver.incomingAmount.assetCode
      const exchangeRate =
        hlb.config.seed.rates[senderAssetCode][receiverAssetCode]
      const fee = c9.config.seed.fees.find((fee: Fee) => fee.asset === 'USD')

      // Expected amounts depend on the configuration of asset codes, scale, exchange rate, and fees.
      assert(receiverAssetCode === 'EUR')
      assert(senderAssetCode === 'USD')
      assert(
        receiver.incomingAmount.assetScale === senderWalletAddress.assetScale
      )
      assert(senderWalletAddress.assetScale === 2)
      assert(exchangeRate === 0.91)
      assert(fee)
      assert(fee.fixed === 100)
      assert(fee.basisPoints === 200)
      assert(fee.asset === 'USD')
      assert(fee.scale === 2)
      expect(payment.receiveAmount).toMatchObject({
        assetCode: 'EUR',
        assetScale: 2,
        value: 500n
      })
      expect(payment.debitAmount).toMatchObject({
        assetCode: 'USD',
        assetScale: 2,
        value: 668n
      })
      expect(payment.sentAmount).toMatchObject({
        assetCode: 'USD',
        assetScale: 2,
        value: 550n
      })
    })
  })
})
