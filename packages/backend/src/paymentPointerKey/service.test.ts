import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

import assert from 'assert'
import { PaymentPointerKeyService } from './service'
import { createTestApp, TestContainer } from '../tests/app'
import { truncateTables } from '../tests/tableManager'
import { Config } from '../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '..'
import { AppServices } from '../app'
import { randomAsset } from '../tests/asset'
import { isPaymentPointerError } from '../open_payments/payment_pointer/errors'
import { PaymentPointerService } from '../open_payments/payment_pointer/service'

const TEST_KEY = {
  kid: uuid(),
  x: 'test-public-key',
  kty: 'OKP',
  alg: 'EdDSA',
  crv: 'Ed25519',
  key_ops: ['sign', 'verify'],
  use: 'sig'
}

describe('Payment Pointer Key Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let paymentPointerKeyService: PaymentPointerKeyService
  let paymentPointerService: PaymentPointerService
  let knex: Knex
  const mockMessageProducer = {
    send: jest.fn()
  }

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    deps.bind('messageProducer', async () => mockMessageProducer)
    appContainer = await createTestApp(deps)
    knex = await deps.use('knex')
    paymentPointerKeyService = await deps.use('paymentPointerKeyService')
    paymentPointerService = await deps.use('paymentPointerService')
  })

  afterEach(async (): Promise<void> => {
    jest.useRealTimers()
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('create', (): void => {
    test('adds a key to a payment pointer', async (): Promise<void> => {
      const paymentPointer = await paymentPointerService.create({
        url: 'https://alice.me/.well-known/pay',
        asset: randomAsset()
      })
      assert.ok(!isPaymentPointerError(paymentPointer))

      const options = {
        paymentPointerId: paymentPointer.id,
        jwk: TEST_KEY
      }

      const paymentPointerKey = await paymentPointerKeyService.create(options)

      await expect(paymentPointerKey.paymentPointerId).toEqual(
        options.paymentPointerId
      )
      await expect(paymentPointerKey.jwk).toEqual(options.jwk)
    })
  })

  describe('Fetch Payment Pointer Keys', (): void => {
    test('Can fetch keys by payment pointer id', async (): Promise<void> => {
      const paymentPointer = await paymentPointerService.create({
        url: 'https://alice.me/.well-known/pay',
        asset: randomAsset()
      })
      assert.ok(!isPaymentPointerError(paymentPointer))

      const keyOption = {
        paymentPointerId: paymentPointer.id,
        jwk: TEST_KEY
      }

      await paymentPointerKeyService.create(keyOption)

      const keys = await paymentPointerKeyService.getKeysByPaymentPointerId(
        paymentPointer.id
      )

      expect(keys.length).toEqual(1)
      expect(keys[0].paymentPointerId).toEqual(paymentPointer.id)
      expect(keys[0].jwk).toEqual(TEST_KEY)
    })
  })

  describe('Revoke Payment Pointer Keys', (): void => {
    test('Can revoke a key', async (): Promise<void> => {
      const paymentPointer = await paymentPointerService.create({
        url: 'https://alice.me/.well-known/pay',
        asset: randomAsset()
      })
      assert.ok(!isPaymentPointerError(paymentPointer))

      const keyOption = {
        paymentPointerId: paymentPointer.id,
        jwk: TEST_KEY
      }

      const key = await paymentPointerKeyService.create(keyOption)
      const revokedKeyId = await paymentPointerKeyService.revokeKeyById(key.id)

      expect(revokedKeyId).toEqual(key.id)
    })
  })
})
