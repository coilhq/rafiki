import crypto from 'crypto'
import Koa from 'koa'
import bodyParser from '@koa/bodyparser'
import http from 'http'
import {
  AccountProvider,
  WebhookEventType,
  Webhook
} from 'mock-account-service-lib'
import { TestConfig } from './config'
import { AdminClient } from './admin-client'

export class IntegrationServer {
  private config: TestConfig
  private app: Koa
  private server?: http.Server
  public webhookEventHandler: WebhookEventHandler

  constructor(
    config: TestConfig,
    adminClient: AdminClient,
    accounts: AccountProvider
  ) {
    this.config = config
    this.app = new Koa()
    this.app.use(bodyParser())
    this.webhookEventHandler = new WebhookEventHandler(adminClient, accounts)
  }

  public start(port: number): void {
    this.app.use(async (ctx) => {
      if (ctx.path === '/webhooks' && ctx.method === 'POST') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { body } = ctx.request as Koa.Request & { body?: any }

        if (this.isWebhookEvent(body)) {
          this.webhookEventHandler.handleWebhookEvent(body)
          ctx.status = 200
          ctx.body = 'Webhook received'
        } else {
          ctx.status = 400
          ctx.body = 'Invalid WebhookEvent payload'
        }
      }

      if (ctx.path === '/rates' && ctx.method === 'GET') {
        const { base } = ctx.query
        ctx.body = {
          base,
          rates: {
            ...this.config.seed.rates[base as string]
          }
        }
      }
    })

    this.server = this.app.listen(port)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isWebhookEvent(body: any): body is Webhook {
    return (
      typeof body === 'object' &&
      typeof body.id === 'string' &&
      typeof body.type === 'string' &&
      typeof body.data === 'object'
    )
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve()

      this.server.close((err) => {
        if (err) {
          reject(err)
        }

        resolve()
      })
    })
  }
}

export class WebhookEventHandler {
  private adminClient: AdminClient
  private accounts: AccountProvider

  constructor(adminClient: AdminClient, accounts: AccountProvider) {
    this.adminClient = adminClient
    this.accounts = accounts
  }

  public async handleWebhookEvent(webhookEvent: Webhook) {
    switch (webhookEvent.type) {
      case WebhookEventType.WalletAddressNotFound:
        await this.handleWalletAddressNotFound(webhookEvent)
        break
      case WebhookEventType.IncomingPaymentCreated:
        break
      case WebhookEventType.IncomingPaymentCompleted:
        break
      case WebhookEventType.OutgoingPaymentCreated:
        await this.handleOutgoingPaymentCreated(webhookEvent)
        break
      case WebhookEventType.OutgoingPaymentCompleted:
        break
      default:
        console.log(`unknown event type: ${webhookEvent.type}`)
    }
  }

  private async handleWalletAddressNotFound(webhookEvent: Webhook) {
    const url = webhookEvent.data['walletAddressUrl']

    if (!url || typeof url !== 'string') {
      throw new Error('No walletAddressUrl found')
    }

    const accountPath = new URL(url).pathname.substring(1)
    const account = await this.accounts.getByPath(accountPath)

    if (!account) {
      throw new Error('No account found for wallet address')
    }

    const { assetId, name: publicName } = account

    const response = await this.adminClient.createWalletAddress({
      assetId,
      publicName,
      url,
      additionalProperties: []
    })
    const { walletAddress } = response

    if (!walletAddress) {
      throw new Error('Could not get wallet address')
    }

    await this.accounts.setWalletAddress(
      account.id,
      walletAddress.id,
      walletAddress.url
    )
  }

  private async handleOutgoingPaymentCreated(webhookEvent: Webhook) {
    const payment = webhookEvent.data
    const walletAddressId = payment['walletAddressId'] as string
    const account = await this.accounts.getByWalletAddressId(walletAddressId)

    if (!account) {
      throw new Error('No account found for wallet address')
    }

    if (typeof payment.id !== 'string' || !payment.id) {
      throw new Error('No payment id found')
    }

    let amount: bigint
    try {
      amount = BigInt((payment.debitAmount as { value: string }).value)
    } catch (err) {
      throw new Error('Invalid debitAmount on payment')
    }

    await this.accounts.pendingDebit(account.id, amount)

    const response = await this.adminClient.depositOutgoingPaymentLiquidity({
      outgoingPaymentId: payment.id,
      idempotencyKey: crypto.randomUUID()
    })

    if (!response.success) {
      const msg = 'Deposit outgoing payment liquidity failed'
      throw new Error(msg)
    }
  }
}
