import { StreamServer } from '@interledger/stream-receiver'
import { Redis } from 'ioredis'

import { AccountingService } from '../../../accounting/service'
import { IncomingPaymentService } from '../../../open_payments/payment/incoming/service'
import { WalletAddressService } from '../../../open_payments/wallet_address/service'
import { RatesService } from '../../../rates/service'
import { BaseService } from '../../../shared/baseService'
import { TelemetryService } from '../../../telemetry/meter'
import { PeerService } from '../peer/service'
import {
  ILPContext,
  ILPMiddleware,
  Rafiki,
  createAccountMiddleware,
  createApp,
  createBalanceMiddleware,
  createClientController,
  createIldcpMiddleware,
  createIncomingErrorHandlerMiddleware,
  createIncomingMaxPacketAmountMiddleware,
  createIncomingRateLimitMiddleware,
  createIncomingThroughputMiddleware,
  createOutgoingExpireMiddleware,
  createOutgoingReduceExpiryMiddleware,
  createOutgoingThroughputMiddleware,
  createOutgoingValidateFulfillmentMiddleware,
  createStreamAddressMiddleware,
  createStreamController
} from './core'

interface ServiceDependencies extends BaseService {
  redis: Redis
  ratesService: RatesService
  accountingService: AccountingService
  telemetry: TelemetryService
  walletAddressService: WalletAddressService
  incomingPaymentService: IncomingPaymentService
  peerService: PeerService
  streamServer: StreamServer
  ilpAddress: string
}

export async function createConnectorService({
  logger,
  redis,
  ratesService,
  accountingService,
  telemetry,
  walletAddressService,
  incomingPaymentService,
  peerService,
  streamServer,
  ilpAddress
}: ServiceDependencies): Promise<Rafiki> {
  return createApp(
    {
      //router: router,
      logger: logger.child({
        service: 'ConnectorService'
      }),
      accounting: accountingService,
      telemetry,
      walletAddresses: walletAddressService,
      incomingPayments: incomingPaymentService,
      peers: peerService,
      redis,
      rates: ratesService,
      streamServer
    },
    compose([
      // Incoming Rules
      createIncomingErrorHandlerMiddleware(ilpAddress),
      createStreamAddressMiddleware(),
      createAccountMiddleware(ilpAddress),
      createIncomingMaxPacketAmountMiddleware(),
      createIncomingRateLimitMiddleware({}),
      createIncomingThroughputMiddleware(),
      createIldcpMiddleware(ilpAddress),

      // Local pay
      createBalanceMiddleware(),
      // Outgoing Rules
      createStreamController(),
      createOutgoingThroughputMiddleware(),
      createOutgoingReduceExpiryMiddleware({}),
      createOutgoingExpireMiddleware(),
      createOutgoingValidateFulfillmentMiddleware(),

      // Send outgoing packets
      createClientController()
    ])
  )
}

// Adapted from koa-compose
function compose(middlewares: ILPMiddleware[]): ILPMiddleware {
  return function (ctx: ILPContext, next: () => Promise<void>): Promise<void> {
    // last called middleware
    let index = -1
    return (function dispatch(i: number): Promise<void> {
      if (i <= index)
        return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middlewares[i]
      if (i === middlewares.length) fn = next
      if (!fn) return Promise.resolve()
      try {
        return Promise.resolve(fn(ctx, dispatch.bind(null, i + 1)))
      } catch (err) {
        return Promise.reject(err)
      }
    })(0)
  }
}
