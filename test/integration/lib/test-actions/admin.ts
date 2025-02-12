import assert from 'assert'
import {
  Receiver,
  Quote,
  OutgoingPayment,
  OutgoingPaymentState,
  CreateReceiverInput,
  IncomingPayment,
  CreateQuoteInput
} from 'test-lib/dist/generated/graphql'
import type { MockASE } from 'test-lib'
import { pollCondition } from '../utils'
import { WebhookEventType } from 'mock-account-service-lib'

interface AdminActionsDeps {
  sendingASE: MockASE
  receivingASE: MockASE
}

export interface AdminActions {
  createReceiver(input: CreateReceiverInput): Promise<Receiver>
  createQuote(input: CreateQuoteInput): Promise<Quote>
  createOutgoingPayment(
    senderWalletAddressId: string,
    quote: Quote
  ): Promise<OutgoingPayment>
  getIncomingPayment(incomingPaymentId: string): Promise<IncomingPayment>
  getOutgoingPayment(
    outgoingPaymentId: string,
    amountValueToSend: string
  ): Promise<OutgoingPayment>
}

export function createAdminActions(deps: AdminActionsDeps): AdminActions {
  return {
    createReceiver: (input) => createReceiver(deps, input),
    createQuote: (input) => createQuote(deps, input),
    createOutgoingPayment: (senderWalletAddressId, quote) =>
      createOutgoingPayment(deps, senderWalletAddressId, quote),
    getIncomingPayment: (incomingPaymentId) =>
      getIncomingPayment(deps, incomingPaymentId),
    getOutgoingPayment: (outgoingPaymentId, amountValueToSend) =>
      getOutgoingPayment(deps, outgoingPaymentId, amountValueToSend)
  }
}

async function createReceiver(
  deps: AdminActionsDeps,
  input: CreateReceiverInput
): Promise<Receiver> {
  const { receivingASE, sendingASE } = deps
  const handleWebhookEventSpy = jest.spyOn(
    receivingASE.integrationServer.webhookEventHandler,
    'handleWebhookEvent'
  )
  const response = await sendingASE.adminClient.createReceiver(input)

  assert(response.receiver)

  await pollCondition(
    () => {
      return handleWebhookEventSpy.mock.calls.some(
        (call) => call[0]?.type === WebhookEventType.IncomingPaymentCreated
      )
    },
    5,
    0.5
  )

  expect(handleWebhookEventSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      type: WebhookEventType.IncomingPaymentCreated,
      data: expect.any(Object)
    })
  )

  return response.receiver
}
async function createQuote(
  deps: AdminActionsDeps,
  input: CreateQuoteInput
): Promise<Quote> {
  const { sendingASE } = deps
  const response = await sendingASE.adminClient.createQuote(input)

  assert(response.quote)

  return response.quote
}
async function createOutgoingPayment(
  deps: AdminActionsDeps,
  senderWalletAddressId: string,
  quote: Quote
): Promise<OutgoingPayment> {
  const { sendingASE } = deps
  const handleWebhookEventSpy = jest.spyOn(
    sendingASE.integrationServer.webhookEventHandler,
    'handleWebhookEvent'
  )

  const response = await sendingASE.adminClient.createOutgoingPayment({
    walletAddressId: senderWalletAddressId,
    quoteId: quote.id
  })

  assert(response.payment)

  await pollCondition(
    () => {
      return (
        handleWebhookEventSpy.mock.calls.some(
          (call) => call[0]?.type === WebhookEventType.OutgoingPaymentCreated
        ) &&
        handleWebhookEventSpy.mock.calls.some(
          (call) => call[0]?.type === WebhookEventType.OutgoingPaymentCompleted
        )
      )
    },
    5,
    0.5
  )

  expect(handleWebhookEventSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      type: WebhookEventType.OutgoingPaymentCreated,
      data: expect.any(Object)
    })
  )
  expect(handleWebhookEventSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      type: WebhookEventType.OutgoingPaymentCompleted,
      data: expect.any(Object)
    })
  )

  return response.payment
}
async function getOutgoingPayment(
  deps: AdminActionsDeps,
  outgoingPaymentId: string,
  amountValueToSend: string
): Promise<OutgoingPayment> {
  const { sendingASE } = deps
  const payment =
    await sendingASE.adminClient.getOutgoingPayment(outgoingPaymentId)
  payment.receiveAmount.value = BigInt(payment.receiveAmount.value)
  payment.sentAmount.value = BigInt(payment.sentAmount.value)
  payment.debitAmount.value = BigInt(payment.debitAmount.value)
  expect(payment.state).toBe(OutgoingPaymentState.Completed)
  expect(payment.receiveAmount.value).toBe(BigInt(amountValueToSend))
  return payment
}
async function getIncomingPayment(
  deps: AdminActionsDeps,
  incomingPaymentId: string
): Promise<IncomingPayment> {
  const { receivingASE } = deps
  const payment =
    await receivingASE.adminClient.getIncomingPayment(incomingPaymentId)

  if (payment.incomingAmount?.value) {
    payment.incomingAmount.value = BigInt(payment.incomingAmount.value)
  }
  payment.receivedAmount.value = BigInt(payment.receivedAmount.value)

  return payment
}
