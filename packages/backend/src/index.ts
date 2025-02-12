import { Ioc, IocContract } from '@adonisjs/fold'
import { Redis } from 'ioredis'
import { knex } from 'knex'
import { Model } from 'objection'
import createLogger from 'pino'
import { createClient } from 'tigerbeetle-node'
import { createClient as createIntrospectionClient } from 'token-introspection'
import net from 'net'
import dns from 'dns'
import { createHmac } from 'crypto'

import {
  createAuthenticatedClient as createOpenPaymentsClient,
  getResourceServerOpenAPI,
  getWalletAddressServerOpenAPI
} from '@interledger/open-payments'
import { StreamServer } from '@interledger/stream-receiver'
import axios from 'axios'
import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  InMemoryCache
} from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { setContext } from '@apollo/client/link/context'
import { canonicalize } from 'json-canonicalize'
import { print } from 'graphql/language/printer'

import { createAccountingService as createPsqlAccountingService } from './accounting/psql/service'
import { createAccountingService as createTigerbeetleAccountingService } from './accounting/tigerbeetle/service'
import { App, AppServices } from './app'
import { createAssetService } from './asset/service'
import { Config } from './config/app'
import { createFeeService } from './fee/service'
import { createAuthServerService } from './open_payments/authServer/service'
import { createGrantService } from './open_payments/grant/service'
import { createCombinedPaymentService } from './open_payments/payment/combined/service'
import { createIncomingPaymentRoutes } from './open_payments/payment/incoming/routes'
import { createIncomingPaymentService } from './open_payments/payment/incoming/service'
import { createRemoteIncomingPaymentService } from './open_payments/payment/incoming_remote/service'
import { createOutgoingPaymentRoutes } from './open_payments/payment/outgoing/routes'
import { createOutgoingPaymentService } from './open_payments/payment/outgoing/service'
import { createQuoteRoutes } from './open_payments/quote/routes'
import { createQuoteService } from './open_payments/quote/service'
import { createReceiverService } from './open_payments/receiver/service'
import { createWalletAddressKeyRoutes } from './open_payments/wallet_address/key/routes'
import { createWalletAddressKeyService } from './open_payments/wallet_address/key/service'
import { createWalletAddressRoutes } from './open_payments/wallet_address/routes'
import { createWalletAddressService } from './open_payments/wallet_address/service'
import { createPaymentMethodHandlerService } from './payment-method/handler/service'
import { createAutoPeeringRoutes } from './payment-method/ilp/auto-peering/routes'
import { createAutoPeeringService } from './payment-method/ilp/auto-peering/service'
import { createConnectorService } from './payment-method/ilp/connector'
import {
  IlpPlugin,
  IlpPluginOptions,
  createIlpPlugin
} from './payment-method/ilp/ilp_plugin'
import { createHttpTokenService } from './payment-method/ilp/peer-http-token/service'
import { createPeerService } from './payment-method/ilp/peer/service'
import { createIlpPaymentService } from './payment-method/ilp/service'
import {
  createLocalPaymentService,
  ServiceDependencies as LocalPaymentServiceDependencies
} from './payment-method/local/service'
import { createSPSPRoutes } from './payment-method/ilp/spsp/routes'
import { createStreamCredentialsService } from './payment-method/ilp/stream-credentials/service'
import { createRatesService } from './rates/service'
import {
  createTelemetryService,
  createNoopTelemetryService
} from './telemetry/service'
import { createWebhookService } from './webhook/service'
import { createInMemoryDataStore } from './middleware/cache/data-stores/in-memory'
import { createTenantService } from './tenants/service'
import { AuthServiceClient } from './auth-service-client/client'
import { createTenantSettingService } from './tenants/settings/service'

BigInt.prototype.toJSON = function () {
  return this.toString()
}

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
      searchPath: config.dbSchema,
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
    if (config.dbSchema) {
      await db.raw(`CREATE SCHEMA IF NOT EXISTS "${config.dbSchema}"`)
    }
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

  container.singleton('apolloClient', async (deps) => {
    const [logger, config] = await Promise.all([
      deps.use('logger'),
      deps.use('config')
    ])

    const httpLink = createHttpLink({
      uri: config.authAdminApiUrl
    })

    const errorLink = onError(({ graphQLErrors }) => {
      if (graphQLErrors) {
        logger.error(graphQLErrors)
        graphQLErrors.map(({ extensions }) => {
          if (extensions && extensions.code === 'UNAUTHENTICATED') {
            logger.error('UNAUTHENTICATED')
          }

          if (extensions && extensions.code === 'FORBIDDEN') {
            logger.error('FORBIDDEN')
          }
        })
      }
    })

    const authLink = setContext((request, { headers }) => {
      if (!config.authAdminApiSecret || !config.authAdminApiSignatureVersion)
        return { headers }
      const timestamp = Date.now()
      const version = config.authAdminApiSignatureVersion

      const { query, variables, operationName } = request
      const formattedRequest = {
        variables,
        operationName,
        query: print(query)
      }

      const payload = `${timestamp}.${canonicalize(formattedRequest)}`
      const hmac = createHmac('sha256', config.authAdminApiSecret)
      hmac.update(payload)
      const digest = hmac.digest('hex')

      return {
        headers: {
          ...headers,
          signature: `t=${timestamp}, v${version}=${digest}`
        }
      }
    })

    const link = ApolloLink.from([errorLink, authLink, httpLink])

    const client = new ApolloClient({
      cache: new InMemoryCache({}),
      link: link,
      defaultOptions: {
        query: {
          fetchPolicy: 'no-cache'
        },
        mutate: {
          fetchPolicy: 'no-cache'
        },
        watchQuery: {
          fetchPolicy: 'no-cache'
        }
      }
    })

    return client
  })

  container.singleton('tenantCache', async () => {
    return createInMemoryDataStore(config.localCacheDuration)
  })

  container.singleton('authServiceClient', () => {
    return new AuthServiceClient(config.authServiceApiUrl)
  })

  container.singleton('tenantService', async (deps) => {
    return createTenantService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      tenantCache: await deps.use('tenantCache'),
      authServiceClient: deps.use('authServiceClient'),
      tenantSettingService: await deps.use('tenantSettingService')
    })
  })

  container.singleton('tenantSettingService', async (deps) => {
    const [logger, knex] = await Promise.all([
      deps.use('logger'),
      deps.use('knex')
    ])
    return createTenantSettingService({ logger, knex })
  })

  container.singleton('ratesService', async (deps) => {
    const config = await deps.use('config')
    return createRatesService({
      logger: await deps.use('logger'),
      exchangeRatesUrl: config.exchangeRatesUrl,
      exchangeRatesLifetime: config.exchangeRatesLifetime
    })
  })

  container.singleton('internalRatesService', async (deps) => {
    return createRatesService({
      logger: await deps.use('logger'),
      exchangeRatesUrl: config.telemetryExchangeRatesUrl,
      exchangeRatesLifetime: config.telemetryExchangeRatesLifetime
    })
  })

  container.singleton('telemetry', async (deps) => {
    const config = await deps.use('config')

    if (!config.enableTelemetry) {
      return createNoopTelemetryService()
    }

    return createTelemetryService({
      logger: await deps.use('logger'),
      aseRatesService: await deps.use('ratesService'),
      internalRatesService: await deps.use('internalRatesService')!,
      instanceName: config.instanceName,
      collectorUrls: config.openTelemetryCollectors,
      exportIntervalMillis: config.openTelemetryExportInterval,
      baseAssetCode: 'USD',
      baseScale: 4
    })
  })

  container.singleton('openApi', async () => {
    const resourceServerSpec = await getResourceServerOpenAPI()
    const walletAddressServerSpec = await getWalletAddressServerOpenAPI()

    return {
      resourceServerSpec,
      walletAddressServerSpec
    }
  })
  container.singleton('openPaymentsClient', async (deps) => {
    const config = await deps.use('config')
    const logger = await deps.use('logger')
    return createOpenPaymentsClient({
      logger,
      keyId: config.keyId,
      privateKey: config.privateKey,
      walletAddressUrl: config.walletAddressUrl,
      useHttp: process.env.NODE_ENV === 'development'
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
  container.singleton('assetCache', async () => {
    return createInMemoryDataStore(config.localCacheDuration)
  })
  container.singleton('assetService', async (deps) => {
    const logger = await deps.use('logger')
    const knex = await deps.use('knex')
    return await createAssetService({
      logger: logger,
      knex: knex,
      accountingService: await deps.use('accountingService'),
      assetCache: await deps.use('assetCache')
    })
  })

  container.singleton('accountingService', async (deps) => {
    const logger = await deps.use('logger')
    const knex = await deps.use('knex')
    const config = await deps.use('config')
    const telemetry = await deps.use('telemetry')

    if (config.useTigerBeetle) {
      container.singleton('tigerBeetle', async (deps) => {
        const config = await deps.use('config')
        return createClient({
          cluster_id: BigInt(config.tigerBeetleClusterId),
          replica_addresses: await parseAndLookupAddresses(
            config.tigerBeetleReplicaAddresses
          )
        })
      })
      const tigerBeetle = await deps.use('tigerBeetle')!
      return createTigerbeetleAccountingService({
        logger,
        knex,
        tigerBeetle,
        withdrawalThrottleDelay: config.withdrawalThrottleDelay,
        telemetry
      })
    }

    return createPsqlAccountingService({
      logger,
      knex,
      withdrawalThrottleDelay: config.withdrawalThrottleDelay,
      telemetry
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
      openPaymentsClient: await deps.use('openPaymentsClient'),
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
  container.singleton('walletAddressCache', async () => {
    return createInMemoryDataStore(config.localCacheDuration)
  })
  container.singleton('walletAddressService', async (deps) => {
    const logger = await deps.use('logger')
    return await createWalletAddressService({
      config: await deps.use('config'),
      knex: await deps.use('knex'),
      logger: logger,
      accountingService: await deps.use('accountingService'),
      webhookService: await deps.use('webhookService'),
      assetService: await deps.use('assetService'),
      walletAddressCache: await deps.use('walletAddressCache')
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
      assetService: await deps.use('assetService'),
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
    return createWalletAddressRoutes({
      config: await deps.use('config'),
      walletAddressService: await deps.use('walletAddressService')
    })
  })
  container.singleton('walletAddressKeyRoutes', async (deps) => {
    return createWalletAddressKeyRoutes({
      config: await deps.use('config'),
      logger: await deps.use('logger'),
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
    return await createReceiverService({
      logger: await deps.use('logger'),
      streamCredentialsService: await deps.use('streamCredentialsService'),
      incomingPaymentService: await deps.use('incomingPaymentService'),
      walletAddressService: await deps.use('walletAddressService'),
      remoteIncomingPaymentService: await deps.use(
        'remoteIncomingPaymentService'
      ),
      telemetry: await deps.use('telemetry')
    })
  })

  container.singleton('walletAddressKeyService', async (deps) => {
    return createWalletAddressKeyService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex')
    })
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
      ilpAddress: config.ilpAddress,
      telemetry: await deps.use('telemetry')
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
    return await createIlpPaymentService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      config: await deps.use('config'),
      makeIlpPlugin: await deps.use('makeIlpPlugin'),
      ratesService: await deps.use('ratesService'),
      telemetry: await deps.use('telemetry')
    })
  })

  container.singleton('localPaymentService', async (deps) => {
    const serviceDependencies: LocalPaymentServiceDependencies = {
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      config: await deps.use('config'),
      ratesService: await deps.use('ratesService'),
      accountingService: await deps.use('accountingService'),
      incomingPaymentService: await deps.use('incomingPaymentService')
    }

    return createLocalPaymentService(serviceDependencies)
  })

  container.singleton('paymentMethodHandlerService', async (deps) => {
    return createPaymentMethodHandlerService({
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      ilpPaymentService: await deps.use('ilpPaymentService'),
      localPaymentService: await deps.use('localPaymentService')
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
      assetService: await deps.use('assetService'),
      paymentMethodHandlerService: await deps.use(
        'paymentMethodHandlerService'
      ),
      telemetry: await deps.use('telemetry')
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
      config: await deps.use('config'),
      logger: await deps.use('logger'),
      knex: await deps.use('knex'),
      accountingService: await deps.use('accountingService'),
      receiverService: await deps.use('receiverService'),
      paymentMethodHandlerService: await deps.use(
        'paymentMethodHandlerService'
      ),
      peerService: await deps.use('peerService'),
      walletAddressService: await deps.use('walletAddressService'),
      quoteService: await deps.use('quoteService'),
      assetService: await deps.use('assetService'),
      telemetry: await deps.use('telemetry')
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

export const parseAndLookupAddresses = async (
  replicaAddresses: string[]
): Promise<string[]> => {
  const parsed = []
  for (const addr of replicaAddresses) {
    const parts = addr.split(':')
    if (!parts)
      throw new Error(
        `Cannot parse replicaAddresses in 'accountingService' startup - value: "${addr}"`
      )
    if (parts.length === 1 && !isNaN(Number(parts[0]))) {
      parsed.push(parts[0])
      continue
    }

    if (net.isIP(parts[0]) === 0) {
      try {
        await dns.promises.lookup(parts[0], { family: 4 }).then((resp) => {
          parsed.push(`${resp.address}:${parts[1]}`)
        })
      } catch (err) {
        throw new Error(
          `Lookup error while parsing replicaAddresses in 'accountingService' startup - cannot resolve: "${addr[0]}" of "${addr}". ${err}`
        )
      }
    } else parsed.push(addr)
  }
  return parsed
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

  const config = await container.use('config')
  if (config.useTigerBeetle) {
    const tigerBeetle = await container.use('tigerBeetle')
    tigerBeetle?.destroy()
  }

  const redis = await container.use('redis')
  await redis.quit()
  redis.disconnect()

  const telemetry = await container.use('telemetry')
  telemetry.shutdown()
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
      logger.error({ err: errInfo }, 'error while shutting down')
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
      logger.error({ err: errInfo }, 'error while shutting down')
      process.exit(1)
    }
  })

  const config = await container.use('config')

  // Do migrations
  const knex = await container.use('knex')

  if (!config.enableManualMigrations) {
    // Needs a wrapped inline function
    await callWithRetry(async () => {
      await knex.migrate.latest({
        directory: __dirname + '/../migrations'
      })
    })
  }

  Model.knex(knex)

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
if (require.main === module) {
  const container = initIocContainer(Config)
  const app = new App(container)

  start(container, app).catch(async (e): Promise<void> => {
    const errInfo = e && typeof e === 'object' && e.stack ? e.stack : e
    const logger = await container.use('logger')
    logger.error({ err: errInfo })
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
