import { Knex } from 'knex'
import { createTestApp, TestContainer } from '../../../tests/app'
import { StreamCredentialsService } from './service'
import { IncomingPayment } from '../../../open_payments/payment/incoming/model'
import { Config } from '../../../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../..'
import { AppServices } from '../../../app'
import { createIncomingPayment } from '../../../tests/incomingPayment'
import { createWalletAddress } from '../../../tests/walletAddress'
import { truncateTables } from '../../../tests/tableManager'
import assert from 'assert'
import { IncomingPaymentState } from '../../../graphql/generated/graphql'

describe('Stream Credentials Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let streamCredentialsService: StreamCredentialsService
  let knex: Knex
  let incomingPayment: IncomingPayment

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    appContainer = await createTestApp(deps)
    streamCredentialsService = await deps.use('streamCredentialsService')
    knex = appContainer.knex
  })

  beforeEach(async (): Promise<void> => {
    const { id: walletAddressId } = await createWalletAddress(deps, {
      tenantId: Config.operatorTenantId
    })
    incomingPayment = await createIncomingPayment(deps, {
      walletAddressId,
      tenantId: Config.operatorTenantId
    })
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get', (): void => {
    test('returns stream credentials for incoming payment', (): void => {
      const credentials = streamCredentialsService.get(incomingPayment)
      assert.ok(credentials)
      expect(credentials).toMatchObject({
        ilpAddress: expect.stringMatching(/^test\.rafiki\.[a-zA-Z0-9_-]{95}$/),
        sharedSecret: expect.any(Buffer)
      })
    })

    test.each`
      state
      ${IncomingPaymentState.Completed}
      ${IncomingPaymentState.Expired}
    `(
      `returns undefined for $state incoming payment`,
      async ({ state }): Promise<void> => {
        await incomingPayment.$query(knex).patch({
          state,
          expiresAt:
            state === IncomingPaymentState.Expired ? new Date() : undefined
        })
        expect(streamCredentialsService.get(incomingPayment)).toBeUndefined()
      }
    )
  })
})
