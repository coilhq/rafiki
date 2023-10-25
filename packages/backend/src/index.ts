import path from 'path'
import createLogger from 'pino'
import { knex } from 'knex'
import { Model } from 'objection'
import { Ioc, IocContract } from '@adonisjs/fold'
import { Redis } from 'ioredis'
import { createClient } from 'tigerbeetle-node'
import { createClient as createIntrospectionClient } from 'token-introspection'

import { App, AppServices } from './app'
import { Config } from './config/app'
import { createRatesService } from './rates/service'
import { createQuoteRoutes } from './open_payments/quote/routes'
import { createQuoteService } from './open_payments/quote/service'
import { createOutgoingPaymentRoutes } from './open_payments/payment/outgoing/routes'
import { createOutgoingPaymentService } from './open_payments/payment/outgoing/service'
import {
  createIlpPlugin,
  IlpPlugin,
  IlpPluginOptions
} from './payment-method/ilp/ilp_plugin'
import { createHttpTokenService } from './payment-method/ilp/peer-http-token/service'
import { createAssetService } from './asset/service'
import { createAccountingService as createTigerbeetleAccountingService } from './accounting/tigerbeetle/service'
import { createAccountingService as createPsqlAccountingService } from './accounting/psql/service'
import { createPeerService } from './payment-method/ilp/peer/service'
import { createAuthServerService } from './open_payments/authServer/service'
import { createGrantService } from './open_payments/grant/service'
import { createSPSPRoutes } from './payment-method/ilp/spsp/routes'
import { createWalletAddressService } from './open_payments/wallet_address/service'
import { createWalletAddressKeyRoutes } from './open_payments/wallet_address/key/routes'
import { createWalletAddressRoutes } from './open_payments/wallet_address/routes'
import { createIncomingPaymentRoutes } from './open_payments/payment/incoming/routes'
import { createIncomingPaymentService } from './open_payments/payment/incoming/service'
import { StreamServer } from '@interledger/stream-receiver'
import { createWebhookService } from './webhook/service'
import { createConnectorService } from './payment-method/ilp/connector'
import { createOpenAPI } from '@interledger/openapi'
import { createAuthenticatedClient as createOpenPaymentsClient } from '@interledger/open-payments'
import { createStreamCredentialsService } from './payment-method/ilp/stream-credentials/service'
import { createWalletAddressKeyService } from './open_payments/wallet_address/key/service'
import { createReceiverService } from './open_payments/receiver/service'
import { createRemoteIncomingPaymentService } from './open_payments/payment/incoming_remote/service'
import { createCombinedPaymentService } from './open_payments/payment/combined/service'
import { createFeeService } from './fee/service'
import { createAutoPeeringService } from './payment-method/ilp/auto-peering/service'
import { createAutoPeeringRoutes } from './payment-method/ilp/auto-peering/routes'
import axios from 'axios'
import { createIlpPaymentService } from './payment-method/ilp/service'
import { createPaymentMethodHandlerService } from './payment-method/handler/service'

BigInt.prototype.toJSON = function () {
  return this.toString()
}

const container = initIocContainer(Config)
const app = new App(container)

export function initIocContainer(
  config: typeof Config
): IocContract<AppServices> {
  const container: IocContract<AppServices> = new Ioc()
  container.singleton('config', async () => config)
  container.singleton('axios', async () => axios.create())
  container.singleton('logger', async (deps: IocContract<AppServices>) => {
    const config = await deps.use('config')
    const logger = createLogger()
    logger.level = config.logLevel
    return logger
  })
  container.singleton('knex', async (deps: IocContract<AppServices>) => {
    const logger = await deps.use('logger')
    const config = await deps.use('config')
    logger.info({ msg: 'creating knex' })
    const db = knex({
      client: 'postgresql',
      connection: config.databaseUrl,
      pool: {
        min: 2,
        max: 10
      },
      migrations: {
        directory: './',
        tableName: 'knex_migrations'
      },
      log: {
        warn(message) {
          logger.warn(message)
        },
        error(message) {
          logger.error(message)
        },
        deprecate(message) {
          logger.warn(message)
        },
        debug(message) {
          logger.debug(message)
        }
      }
    })
    // node pg defaults to returning bigint as string. This ensures it parses to bigint
    db.client.driver.types.setTypeParser(
      db.client.driver.types.builtins.INT8,
      'text',
      BigInt
    )
    return db
  })
  container.singleton('redis', async (deps): Promise<Redis> => {
    const config = await deps.use('config')
    return new Redis(config.redisUrl, {
      tls: config.redisTls,
      stringNumbers: true
    })
  })
  container.singleton('streamServer', async (deps) => {
    const config = await deps.use('config')
    return new StreamServer({
      serverSecret: config.streamSecret,
      serverAddress: config.ilpAddress
    })
  })
  container.singleton('tigerbeetle', async (deps) => {
    const config = await deps.use('config')
    return createClient({
      cluster_id: config.tigerbeetleClusterId,
      replica_addresses: config.tigerbeetleReplicaAddresses
    })
  })
  container.singleton('openApi', async () => {
    const resourceServerSpec = await createOpenAPI(
      path.resolve(__dirname, './openapi/resource-server.yaml')
    )
    return {
      resourceServerSpec
    }
  })
  container.singleton('openPaymentsClient', async (deps) => {
    const config = await deps.use('config')
    const logger = await deps.use('logger')
    return createOpenPaymentsClient({
      logger,
      keyId: config.keyId,
      privateKey: config.privateKey,
      walletAddressUrl: config.walletAddressUrl
    })
  })
  container.singleton('tokenIntrospectionClient', async (deps) => {
    const config = await deps.use('config')
    return await createIntrospectionClient({
      logger: await deps.use('logger'),
      url: config.authServerIntrospectionUrl
    })
  })

  /**
   * Add services to the container.
   */
  container.singleton('httpTokenService', async (deps) => {
    const logger = await deps.use('logger')
    const knex = await deps.use('knex')
    return await createHttpTokenService({
      logger: logger,
      knex: knex
    })
  })
  container.singleton('assetService', async (deps) => {
    const logger = await deps.use('logger')
    const knex = await deps.use('knex')
    return await createAssetService({
      logger: logger,
      knex: knex,
      accountingService: await deps.use('accountingService')
    })
  })

  container.singleton('accountingService', async (deps) => {
    const logger = await deps.use('logger')
    const knex = await deps.use('knex')
    const config = await deps.use('config')

    if (config.useTigerbeetle) {
      const tigerbeetle = await deps.use('tigerbeetle')

      return createTigerbeetleAccountingService({
        logger,
        knex,
        tigerbeetle,
        withdrawalThrottleDelay: config.withdrawalThrottleDelay
      })
    }

    return createPsqlAccountingService({
      logger,
      knex,
      withdrawalThrottleDelay: config.withdrawalThrottleDelay
    })
  })
  container.singleton('peerService', async (deps) => {
    return await createPeerService({
      knex: await deps.use('knex'),
      logger: await deps.use('logger'),
      accountingService: await deps.use('accountingService'),
      assetService: await deps.use('assetService'),
      httpTokenService: await deps.use('httpTokenService')
    })
  })
  container.singleton('authServerService', async (deps) => {
    return await createAuthServerService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex')
    })
  })
  container.singleton('grantService', async (deps) => {
    return await createGrantService({
      authServerService: await deps.use('authServerService'),
      logger: await deps.use('logger'),
      knex: await deps.use('knex')
    })
  })
  container.singleton('webhookService', async (deps) => {
    return createWebhookService({
      config: await deps.use('config'),
      knex: await deps.use('knex'),
      logger: await deps.use('logger')
    })
  })
  container.singleton('walletAddressService', async (deps) => {
    const logger = await deps.use('logger')
    return await createWalletAddressService({
      config: await deps.use('config'),
      knex: await deps.use('knex'),
      logger: logger,
      accountingService: await deps.use('accountingService'),
      webhookService: await deps.use('webhookService')
    })
  })
  container.singleton('spspRoutes', async (deps) => {
    const logger = await deps.use('logger')
    const streamServer = await deps.use('streamServer')
    return await createSPSPRoutes({
      logger: logger,
      streamServer: streamServer
    })
  })

  container.singleton('incomingPaymentService', async (deps) => {
    return await createIncomingPaymentService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      accountingService: await deps.use('accountingService'),
      walletAddressService: await deps.use('walletAddressService'),
      config: await deps.use('config')
    })
  })
  container.singleton('remoteIncomingPaymentService', async (deps) => {
    return await createRemoteIncomingPaymentService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      grantService: await deps.use('grantService'),
      openPaymentsUrl: config.openPaymentsUrl,
      openPaymentsClient: await deps.use('openPaymentsClient')
    })
  })
  container.singleton('incomingPaymentRoutes', async (deps) => {
    return createIncomingPaymentRoutes({
      config: await deps.use('config'),
      logger: await deps.use('logger'),
      incomingPaymentService: await deps.use('incomingPaymentService'),
      streamCredentialsService: await deps.use('streamCredentialsService')
    })
  })
  container.singleton('walletAddressRoutes', async (deps) => {
    const config = await deps.use('config')
    return createWalletAddressRoutes({
      authServer: config.authServerGrantUrl
    })
  })
  container.singleton('walletAddressKeyRoutes', async (deps) => {
    return createWalletAddressKeyRoutes({
      config: await deps.use('config'),
      walletAddressKeyService: await deps.use('walletAddressKeyService'),
      walletAddressService: await deps.use('walletAddressService')
    })
  })
  container.singleton('streamCredentialsService', async (deps) => {
    const config = await deps.use('config')
    return await createStreamCredentialsService({
      logger: await deps.use('logger'),
      openPaymentsUrl: config.openPaymentsUrl,
      streamServer: await deps.use('streamServer')
    })
  })
  container.singleton('receiverService', async (deps) => {
    const config = await deps.use('config')
    return await createReceiverService({
      logger: await deps.use('logger'),
      streamCredentialsService: await deps.use('streamCredentialsService'),
      grantService: await deps.use('grantService'),
      incomingPaymentService: await deps.use('incomingPaymentService'),
      openPaymentsUrl: config.openPaymentsUrl,
      walletAddressService: await deps.use('walletAddressService'),
      openPaymentsClient: await deps.use('openPaymentsClient'),
      remoteIncomingPaymentService: await deps.use(
        'remoteIncomingPaymentService'
      ),
      config: await deps.use('config')
    })
  })

  container.singleton('ratesService', async (deps) => {
    const config = await deps.use('config')
    return createRatesService({
      logger: await deps.use('logger'),
      exchangeRatesUrl: config.exchangeRatesUrl,
      exchangeRatesLifetime: config.exchangeRatesLifetime
    })
  })

  container.singleton('walletAddressKeyService', async (deps) => {
    return createWalletAddressKeyService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex')
    })
  })

  container.singleton('makeIlpPlugin', async (deps) => {
    const connectorApp = await deps.use('connectorApp')
    return ({
      sourceAccount,
      unfulfillable = false
    }: IlpPluginOptions): IlpPlugin => {
      return createIlpPlugin((data: Buffer): Promise<Buffer> => {
        return connectorApp.handleIlpData(sourceAccount, unfulfillable, data)
      })
    }
  })

  container.singleton('connectorApp', async (deps) => {
    const config = await deps.use('config')
    return await createConnectorService({
      logger: await deps.use('logger'),
      redis: await deps.use('redis'),
      accountingService: await deps.use('accountingService'),
      walletAddressService: await deps.use('walletAddressService'),
      incomingPaymentService: await deps.use('incomingPaymentService'),
      peerService: await deps.use('peerService'),
      ratesService: await deps.use('ratesService'),
      streamServer: await deps.use('streamServer'),
      ilpAddress: config.ilpAddress
    })
  })

  container.singleton('combinedPaymentService', async (deps) => {
    return await createCombinedPaymentService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      incomingPaymentService: await deps.use('incomingPaymentService'),
      outgoingPaymentService: await deps.use('outgoingPaymentService')
    })
  })

  container.singleton('feeService', async (deps) => {
    const logger = await deps.use('logger')
    const knex = await deps.use('knex')
    return await createFeeService({
      logger: logger,
      knex: knex
    })
  })

  container.singleton('autoPeeringService', async (deps) => {
    return createAutoPeeringService({
      axios: await deps.use('axios'),
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      assetService: await deps.use('assetService'),
      peerService: await deps.use('peerService'),
      config: await deps.use('config')
    })
  })

  container.singleton('autoPeeringRoutes', async (deps) => {
    return await createAutoPeeringRoutes({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      autoPeeringService: await deps.use('autoPeeringService')
    })
  })

  container.singleton('ilpPaymentService', async (deps) => {
    return createIlpPaymentService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      config: await deps.use('config'),
      makeIlpPlugin: await deps.use('makeIlpPlugin'),
      ratesService: await deps.use('ratesService')
    })
  })

  container.singleton('paymentMethodHandlerService', async (deps) => {
    return createPaymentMethodHandlerService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      ilpPaymentService: await deps.use('ilpPaymentService')
    })
  })

  container.singleton('quoteService', async (deps) => {
    return await createQuoteService({
      config: await deps.use('config'),
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      receiverService: await deps.use('receiverService'),
      feeService: await deps.use('feeService'),
      walletAddressService: await deps.use('walletAddressService'),
      paymentMethodHandlerService: await deps.use('paymentMethodHandlerService')
    })
  })

  container.singleton('quoteRoutes', async (deps) => {
    return createQuoteRoutes({
      config: await deps.use('config'),
      logger: await deps.use('logger'),
      quoteService: await deps.use('quoteService')
    })
  })

  container.singleton('outgoingPaymentService', async (deps) => {
    return await createOutgoingPaymentService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      accountingService: await deps.use('accountingService'),
      receiverService: await deps.use('receiverService'),
      paymentMethodHandlerService: await deps.use(
        'paymentMethodHandlerService'
      ),
      peerService: await deps.use('peerService'),
      walletAddressService: await deps.use('walletAddressService')
    })
  })
  container.singleton('outgoingPaymentRoutes', async (deps) => {
    return createOutgoingPaymentRoutes({
      config: await deps.use('config'),
      logger: await deps.use('logger'),
      outgoingPaymentService: await deps.use('outgoingPaymentService')
    })
  })

  return container
}

export const gracefulShutdown = async (
  container: IocContract<AppServices>,
  app: App
): Promise<void> => {
  const logger = await container.use('logger')
  logger.info('shutting down.')
  await app.shutdown()
  const knex = await container.use('knex')
  await knex.destroy()
  const tigerbeetle = await container.use('tigerbeetle')
  tigerbeetle.destroy()
  const redis = await container.use('redis')
  redis.disconnect()
}

export const start = async (
  container: IocContract<AppServices>,
  app: App
): Promise<void> => {
  let shuttingDown = false
  const logger = await container.use('logger')
  process.on('SIGINT', async (): Promise<void> => {
    logger.info('received SIGINT attempting graceful shutdown')
    try {
      if (shuttingDown) {
        logger.warn(
          'received second SIGINT during graceful shutdown, exiting forcefully.'
        )
        process.exit(1)
      }

      shuttingDown = true

      // Graceful shutdown
      await gracefulShutdown(container, app)
      logger.info('completed graceful shutdown.')
      process.exit(0)
    } catch (err) {
      const errInfo = err instanceof Error && err.stack ? err.stack : err
      logger.error({ error: errInfo }, 'error while shutting down')
      process.exit(1)
    }
  })

  process.on('SIGTERM', async (): Promise<void> => {
    logger.info('received SIGTERM attempting graceful shutdown')

    try {
      if (shuttingDown) {
        logger.warn(
          'received second SIGTERM during graceful shutdown, exiting forcefully.'
        )
        process.exit(1)
      }

      shuttingDown = true

      // Graceful shutdown
      await gracefulShutdown(container, app)
      logger.info('completed graceful shutdown.')
      process.exit(0)
    } catch (err) {
      const errInfo = err instanceof Error && err.stack ? err.stack : err
      logger.error({ error: errInfo }, 'error while shutting down')
      process.exit(1)
    }
  })

  // Do migrations
  const knex = await container.use('knex')
  // Needs a wrapped inline function
  await callWithRetry(async () => {
    await knex.migrate.latest({
      directory: __dirname + '/../migrations'
    })
  })

  Model.knex(knex)

  const config = await container.use('config')
  await app.boot()
  await app.startAdminServer(config.adminPort)
  logger.info(`Admin listening on ${app.getAdminPort()}`)

  await app.startOpenPaymentsServer(config.openPaymentsPort)
  logger.info(`Open Payments listening on ${app.getOpenPaymentsPort()}`)

  await app.startIlpConnectorServer(config.connectorPort)
  logger.info(`Connector listening on ${config.connectorPort}`)
  logger.info('🐒 has 🚀. Get ready for 🍌🍌🍌🍌🍌')

  if (config.enableAutoPeering) {
    await app.startAutoPeeringServer(config.autoPeeringServerPort)
    logger.info(
      `Auto-peering server listening on ${config.autoPeeringServerPort}`
    )
  }
}

// If this script is run directly, start the server
if (!module.parent) {
  start(container, app).catch(async (e): Promise<void> => {
    const errInfo = e && typeof e === 'object' && e.stack ? e.stack : e
    const logger = await container.use('logger')
    logger.error(errInfo)
  })
}

// Used for running migrations in a try loop with exponential backoff
const callWithRetry: CallableFunction = async (
  fn: CallableFunction,
  depth = 0
) => {
  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

  try {
    return await fn()
  } catch (e) {
    if (depth > 7) {
      throw e
    }
    await wait(2 ** depth * 30)

    return callWithRetry(fn, depth + 1)
  }
}
