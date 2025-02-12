import { IocContract } from '@adonisjs/fold'
import { createTestApp, TestContainer } from '../../tests/app'
import { Config } from '../../config/app'
import { initIocContainer } from '../..'
import { AppServices } from '../../app'
import { createIncomingPayment } from '../../tests/incomingPayment'
import { createWalletAddress } from '../../tests/walletAddress'
import { truncateTables } from '../../tests/tableManager'
import {
  IlpStreamCredentials,
  StreamCredentialsService
} from '../../payment-method/ilp/stream-credentials/service'
import { Receiver } from './model'
import { IncomingPaymentState } from '../payment/incoming/model'
import assert from 'assert'
import base64url from 'base64url'
import { IlpAddress } from 'ilp-packet'

describe('Receiver Model', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let streamCredentialsService: StreamCredentialsService

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer(Config)
    appContainer = await createTestApp(deps)
    streamCredentialsService = await deps.use('streamCredentialsService')
  })

  afterEach(async (): Promise<void> => {
    jest.useRealTimers()
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('constructor', () => {
    test('creates receiver', async () => {
      const walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId
      })
      const incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: walletAddress.id,
        tenantId: Config.operatorTenantId
      })
      const isLocal = true

      const streamCredentials = streamCredentialsService.get(incomingPayment)
      assert(streamCredentials)

      const receiver = new Receiver(
        incomingPayment.toOpenPaymentsTypeWithMethods(
          walletAddress,
          streamCredentials
        ),
        isLocal
      )

      expect(receiver).toEqual({
        assetCode: incomingPayment.asset.code,
        assetScale: incomingPayment.asset.scale,
        ilpAddress: expect.any(String),
        sharedSecret: expect.any(Buffer),
        incomingPayment: {
          id: incomingPayment.getUrl(walletAddress),
          walletAddress: walletAddress.url,
          updatedAt: incomingPayment.updatedAt,
          createdAt: incomingPayment.createdAt,
          completed: incomingPayment.completed,
          receivedAmount: incomingPayment.receivedAmount,
          incomingAmount: incomingPayment.incomingAmount,
          expiresAt: incomingPayment.expiresAt,
          methods: [
            {
              type: 'ilp',
              ilpAddress: streamCredentials.ilpAddress,
              sharedSecret: base64url(streamCredentials.sharedSecret)
            }
          ]
        },
        isLocal
      })
    })

    test('throws if incoming payment is completed', async () => {
      const walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId
      })
      const incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: walletAddress.id,
        tenantId: Config.operatorTenantId
      })

      incomingPayment.state = IncomingPaymentState.Completed
      const streamCredentials: IlpStreamCredentials = {
        ilpAddress: 'test.ilp' as IlpAddress,
        sharedSecret: Buffer.from('')
      }

      const openPaymentsIncomingPayment =
        incomingPayment.toOpenPaymentsTypeWithMethods(
          walletAddress,
          streamCredentials
        )

      expect(() => new Receiver(openPaymentsIncomingPayment, false)).toThrow(
        'Cannot create receiver from completed incoming payment'
      )
    })

    test('throws if incoming payment is expired', async () => {
      const walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId
      })
      const incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: walletAddress.id,
        tenantId: Config.operatorTenantId
      })

      incomingPayment.expiresAt = new Date(Date.now() - 1)
      const streamCredentials = streamCredentialsService.get(incomingPayment)
      assert(streamCredentials)
      const openPaymentsIncomingPayment =
        incomingPayment.toOpenPaymentsTypeWithMethods(
          walletAddress,
          streamCredentials
        )

      expect(() => new Receiver(openPaymentsIncomingPayment, false)).toThrow(
        'Cannot create receiver from expired incoming payment'
      )
    })

    test('throws if stream credentials has invalid ILP address', async () => {
      const walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId
      })
      const incomingPayment = await createIncomingPayment(deps, {
        walletAddressId: walletAddress.id,
        tenantId: Config.operatorTenantId
      })

      const streamCredentials = streamCredentialsService.get(incomingPayment)
      assert(streamCredentials)
      ;(streamCredentials.ilpAddress as string) = 'not base 64 encoded'

      const openPaymentsIncomingPayment =
        incomingPayment.toOpenPaymentsTypeWithMethods(
          walletAddress,
          streamCredentials
        )

      expect(() => new Receiver(openPaymentsIncomingPayment, false)).toThrow(
        'Invalid ILP address on ilp payment method'
      )
    })
  })
})
