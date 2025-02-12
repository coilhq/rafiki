import assert from 'assert'
import type { MockASE } from 'test-lib'
import { parseCookies } from '../utils'
import { WalletAddress, PendingGrant } from '@interledger/open-payments'
import { AdminActions, createAdminActions } from './admin'
import { OpenPaymentsActions, createOpenPaymentsActions } from './open-payments'

export interface TestActionsDeps {
  sendingASE: MockASE
  receivingASE: MockASE
}

export interface TestActions {
  consentInteraction(
    outgoingPaymentGrant: PendingGrant,
    senderWalletAddress: WalletAddress
  ): Promise<void>
  consentInteractionWithInteractRef(
    outgoingPaymentGrant: PendingGrant,
    senderWalletAddress: WalletAddress
  ): Promise<string>
  admin: AdminActions
  openPayments: OpenPaymentsActions
}

export function createTestActions(deps: TestActionsDeps): TestActions {
  return {
    consentInteraction: (outgoingPaymentGrant, senderWalletAddress) =>
      consentInteraction(deps, outgoingPaymentGrant, senderWalletAddress),
    consentInteractionWithInteractRef: (
      outgoingPaymentGrant,
      senderWalletAddress
    ) =>
      consentInteractionWithInteractRef(
        deps,
        outgoingPaymentGrant,
        senderWalletAddress
      ),
    admin: createAdminActions(deps),
    openPayments: createOpenPaymentsActions(deps)
  }
}

async function consentInteraction(
  deps: TestActionsDeps,
  outgoingPaymentGrant: PendingGrant,
  senderWalletAddress: WalletAddress
) {
  const { idpSecret } = deps.sendingASE.config
  const { interactId, nonce, cookie } = await _startAndAcceptInteraction(
    deps,
    outgoingPaymentGrant,
    senderWalletAddress,
    idpSecret
  )

  // Finish interacton
  const finishResponse = await fetch(
    `${senderWalletAddress.authServer}/interact/${interactId}/${nonce}/finish`,
    {
      method: 'GET',
      headers: {
        'x-idp-secret': idpSecret,
        cookie
      }
    }
  )
  expect(finishResponse.status).toBe(202)
}

async function consentInteractionWithInteractRef(
  deps: TestActionsDeps,
  outgoingPaymentGrant: PendingGrant,
  senderWalletAddress: WalletAddress
): Promise<string> {
  const { idpSecret } = deps.sendingASE.config
  const { interactId, nonce, cookie } = await _startAndAcceptInteraction(
    deps,
    outgoingPaymentGrant,
    senderWalletAddress,
    idpSecret
  )

  // Finish interacton
  const finishResponse = await fetch(
    `${senderWalletAddress.authServer}/interact/${interactId}/${nonce}/finish`,
    {
      method: 'GET',
      headers: {
        'x-idp-secret': idpSecret,
        cookie
      },
      redirect: 'manual' // dont follow redirects
    }
  )
  expect(finishResponse.status).toBe(302)

  const redirectURI = finishResponse.headers.get('location')
  assert(redirectURI)

  const url = new URL(redirectURI)
  const interact_ref = url.searchParams.get('interact_ref')
  assert(interact_ref)

  return interact_ref
}

async function _startAndAcceptInteraction(
  deps: TestActionsDeps,
  outgoingPaymentGrant: PendingGrant,
  senderWalletAddress: WalletAddress,
  idpSecret: string
): Promise<{ nonce: string; interactId: string; cookie: string }> {
  const { redirect: startInteractionUrl } = outgoingPaymentGrant.interact

  // Start interaction
  const interactResponse = await fetch(startInteractionUrl, {
    redirect: 'manual' // dont follow redirects
  })
  expect(interactResponse.status).toBe(302)

  const cookie = parseCookies(interactResponse)

  const nonce = outgoingPaymentGrant.interact.finish
  const tokens = startInteractionUrl.split('/interact/')
  const interactId = tokens[1] ? tokens[1].split('/')[0] : null
  assert(interactId)

  // Accept
  const acceptResponse = await fetch(
    `${deps.sendingASE.config.interactionServer}/grant/${interactId}/${nonce}/accept`,
    {
      method: 'POST',
      headers: {
        'x-idp-secret': idpSecret,
        cookie
      }
    }
  )

  expect(acceptResponse.status).toBe(202)

  return { nonce, interactId, cookie }
}
