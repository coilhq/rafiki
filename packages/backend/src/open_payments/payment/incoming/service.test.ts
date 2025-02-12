import assert from 'assert'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

import { IncomingPaymentService } from './service'
import { AccountingService } from '../../../accounting/service'
import { createTestApp, TestContainer } from '../../../tests/app'
import {
  IncomingPayment,
  IncomingPaymentEvent,
  IncomingPaymentEventType,
  IncomingPaymentState
} from './model'
import { Config, IAppConfig } from '../../../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../..'
import { AppServices } from '../../../app'
import { Asset } from '../../../asset/model'
import { createAsset } from '../../../tests/asset'
import { createIncomingPayment } from '../../../tests/incomingPayment'
import { createWalletAddress } from '../../../tests/walletAddress'
import { truncateTables } from '../../../tests/tableManager'
import { IncomingPaymentError, isIncomingPaymentError } from './errors'
import { Amount } from '../../amount'
import { getTests } from '../../wallet_address/model.test'
import { WalletAddress } from '../../wallet_address/model'
import { withConfigOverride } from '../../../tests/helpers'
import { sleep } from '../../../shared/utils'

describe('Incoming Payment Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let incomingPaymentService: IncomingPaymentService
  let knex: Knex
  let walletAddressId: string
  let client: string
  let accountingService: AccountingService
  let asset: Asset
  let config: IAppConfig
  let tenantId: string

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({
      ...Config,
      localCacheDuration: 0
    })
    appContainer = await createTestApp(deps)
    accountingService = await deps.use('accountingService')
    knex = appContainer.knex
    incomingPaymentService = await deps.use('incomingPaymentService')
    config = await deps.use('config')
    tenantId = Config.operatorTenantId
  })

  beforeEach(async (): Promise<void> => {
    asset = await createAsset(deps)
    const address = await createWalletAddress(deps, {
      tenantId: config.operatorTenantId,
      assetId: asset.id
    })
    walletAddressId = address.id
    client = address.url
  })

  afterEach(async (): Promise<void> => {
    jest.useRealTimers()
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('Actionable IncomingPayment', (): void => {
    function actionableIncomingPaymentConfigOverride() {
      return {
        pollIncomingPaymentCreatedWebhook: true,
        incomingPaymentCreatedPollFrequency: 1,
        incomingPaymentCreatedPollTimeout: 100
      }
    }
    async function patchIncomingPaymentHelper(options: {
      approvedAt?: Date
      cancelledAt?: Date
    }) {
      await sleep(50)
      const incomingPaymentEvent = await IncomingPaymentEvent.query(
        knex
      ).findOne({
        type: IncomingPaymentEventType.IncomingPaymentCreated
      })
      assert.ok(!!incomingPaymentEvent)
      await IncomingPayment.query(knex)
        .findById(incomingPaymentEvent.incomingPaymentId as string)
        .patch(options)

      return incomingPaymentService.get({
        id: incomingPaymentEvent.incomingPaymentId as string
      })
    }

    function createIncomingPaymentHelper(): Promise<
      IncomingPayment | IncomingPaymentError
    > {
      const options = {
        client: faker.internet.url({ appendSlash: false }),
        incomingAmount: true,
        expiresAt: new Date(Date.now() + 30_000),
        tenantId
      }

      return incomingPaymentService.create({
        walletAddressId,
        ...options,
        incomingAmount: undefined
      })
    }

    test(
      'should return cancelled incoming payment',
      withConfigOverride(
        () => config,
        actionableIncomingPaymentConfigOverride(),
        async (): Promise<void> => {
          const options = { cancelledAt: new Date(Date.now() - 1) }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [incomingPayment, _] = await Promise.all([
            createIncomingPaymentHelper(),
            patchIncomingPaymentHelper(options)
          ])

          assert.ok(isIncomingPaymentError(incomingPayment))
          expect(incomingPayment).toBe(IncomingPaymentError.ActionNotPerformed)
        }
      )
    )

    test(
      'should return approved incoming payment',
      withConfigOverride(
        () => config,
        actionableIncomingPaymentConfigOverride(),
        async (): Promise<void> => {
          const options = { approvedAt: new Date(Date.now() - 1) }
          const [incomingPayment, approvedIncomingPayment] = await Promise.all([
            createIncomingPaymentHelper(),
            patchIncomingPaymentHelper(options)
          ])

          assert.ok(!isIncomingPaymentError(incomingPayment))
          expect(incomingPayment.id).toEqual(approvedIncomingPayment?.id)
          expect(incomingPayment.approvedAt).toEqual(options.approvedAt)
          expect(!incomingPayment.cancelledAt).toBeTruthy()
        }
      )
    )
    test(
      'should return ActionNotPerformed Error if no action taken',
      withConfigOverride(
        () => config,
        actionableIncomingPaymentConfigOverride(),
        async (): Promise<void> => {
          await expect(
            IncomingPaymentEvent.query(knex).where({
              type: IncomingPaymentEventType.IncomingPaymentCreated
            })
          ).resolves.toHaveLength(0)

          const incomingPayment = await createIncomingPaymentHelper()

          assert.ok(isIncomingPaymentError(incomingPayment))
          expect(incomingPayment).toBe(IncomingPaymentError.ActionNotPerformed)
        }
      )
    )

    describe('approveIncomingPayment', (): void => {
      it('should return UnknownPayment error if payment does not exist', async (): Promise<void> => {
        expect(
          incomingPaymentService.approve(uuid(), Config.operatorTenantId)
        ).resolves.toBe(IncomingPaymentError.UnknownPayment)
      })

      it('should not approve already cancelled incoming payment', async (): Promise<void> => {
        const incomingPayment = await createIncomingPaymentHelper()
        assert.ok(!isIncomingPaymentError(incomingPayment))

        await IncomingPayment.query(knex)
          .findOne({ id: incomingPayment.id })
          .patch({ cancelledAt: new Date() })

        const response = await incomingPaymentService.approve(
          incomingPayment.id,
          Config.operatorTenantId
        )
        expect(response).toBe(IncomingPaymentError.AlreadyActioned)
      })

      it('should not update approvedAt field of already approved incoming payment', async (): Promise<void> => {
        const approvedAt = new Date()
        const incomingPayment = await createIncomingPaymentHelper()
        assert.ok(!isIncomingPaymentError(incomingPayment))

        await IncomingPayment.query(knex)
          .findOne({ id: incomingPayment.id })
          .patch({ approvedAt })

        const approvedPayment = await incomingPaymentService.approve(
          incomingPayment.id,
          Config.operatorTenantId
        )
        assert.ok(!isIncomingPaymentError(approvedPayment))

        expect(approvedPayment.approvedAt?.toISOString()).toBe(
          approvedAt.toISOString()
        )
      })

      it('should approve incoming payment', async (): Promise<void> => {
        const incomingPayment = await createIncomingPaymentHelper()
        assert.ok(!isIncomingPaymentError(incomingPayment))

        await IncomingPayment.query(knex)
          .findOne({ id: incomingPayment.id })
          .patch({ state: IncomingPaymentState.Pending })

        const approvedIncomingPayment = await incomingPaymentService.approve(
          incomingPayment.id,
          Config.operatorTenantId
        )
        assert.ok(!isIncomingPaymentError(approvedIncomingPayment))
        expect(approvedIncomingPayment.id).toBe(incomingPayment.id)
        expect(approvedIncomingPayment.approvedAt).toBeDefined()
        expect(!approvedIncomingPayment.cancelledAt).toBeTruthy()
        expect(approvedIncomingPayment.cancelledAt).toBeFalsy()
      })
    })

    describe('cancelIncomingPayment', (): void => {
      it('should return UnknownPayment error if payment does not exist', async (): Promise<void> => {
        expect(
          incomingPaymentService.cancel(uuid(), Config.operatorTenantId)
        ).resolves.toBe(IncomingPaymentError.UnknownPayment)
      })

      it('should not cancel already approved incoming payment', async (): Promise<void> => {
        const incomingPayment = await createIncomingPaymentHelper()
        assert.ok(!isIncomingPaymentError(incomingPayment))

        await IncomingPayment.query(knex)
          .findOne({ id: incomingPayment.id })
          .patch({ approvedAt: new Date() })

        const response = await incomingPaymentService.cancel(
          incomingPayment.id,
          Config.operatorTenantId
        )
        expect(response).toBe(IncomingPaymentError.AlreadyActioned)
      })

      it('should not update cancelledAt field of already cancelled incoming payment', async (): Promise<void> => {
        const cancelledAt = new Date()
        const incomingPayment = await createIncomingPaymentHelper()
        assert.ok(!isIncomingPaymentError(incomingPayment))

        await IncomingPayment.query(knex)
          .findOne({ id: incomingPayment.id })
          .patch({ cancelledAt })

        const cancelledPayment = await incomingPaymentService.cancel(
          incomingPayment.id,
          Config.operatorTenantId
        )
        assert.ok(!isIncomingPaymentError(cancelledPayment))

        expect(cancelledPayment.cancelledAt?.toISOString()).toBe(
          cancelledAt.toISOString()
        )
      })

      it('should cancel incoming payment', async (): Promise<void> => {
        const incomingPayment = await createIncomingPaymentHelper()
        assert.ok(!isIncomingPaymentError(incomingPayment))

        await IncomingPayment.query(knex)
          .findOne({ id: incomingPayment.id })
          .patch({ state: IncomingPaymentState.Pending })

        const canceledIncomingPayment = await incomingPaymentService.cancel(
          incomingPayment.id,
          Config.operatorTenantId
        )
        assert.ok(!isIncomingPaymentError(canceledIncomingPayment))
        expect(canceledIncomingPayment.id).toBe(incomingPayment.id)
        expect(canceledIncomingPayment.cancelledAt).toBeDefined()
        expect(!canceledIncomingPayment.approvedAt).toBeTruthy()
      })
    })
  })

  describe('Create IncomingPayment', (): void => {
    let amount: Amount

    beforeEach((): void => {
      amount = {
        value: BigInt(123),
        assetCode: asset.code,
        assetScale: asset.scale
      }
    })

    test.each`
      client                                        | incomingAmount | expiresAt                        | metadata
      ${undefined}                                  | ${false}       | ${undefined}                     | ${undefined}
      ${faker.internet.url({ appendSlash: false })} | ${true}        | ${new Date(Date.now() + 30_000)} | ${{ description: 'Test incoming payment', externalRef: '#123', items: [1, 2, 3] }}
    `('An incoming payment can be created', async (options): Promise<void> => {
      await expect(
        IncomingPaymentEvent.query(knex).where({
          type: IncomingPaymentEventType.IncomingPaymentCreated
        })
      ).resolves.toHaveLength(0)
      options.client = client
      const incomingPayment = await incomingPaymentService.create({
        walletAddressId,
        ...options,
        incomingAmount: options.incomingAmount ? amount : undefined
      })
      assert.ok(!isIncomingPaymentError(incomingPayment))
      expect(incomingPayment).toMatchObject({
        id: incomingPayment.id,
        client,
        asset,
        processAt: new Date(incomingPayment.expiresAt.getTime()),
        metadata: options.metadata ?? null
      })
      await expect(
        IncomingPaymentEvent.query(knex).where({
          type: IncomingPaymentEventType.IncomingPaymentCreated
        })
      ).resolves.toHaveLength(1)
    })

    test('Cannot create incoming payment for nonexistent wallet address', async (): Promise<void> => {
      await expect(
        incomingPaymentService.create({
          walletAddressId: uuid(),
          incomingAmount: {
            value: BigInt(123),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.UnknownWalletAddress)
    })

    test('Cannot create incoming payment with different asset details than underlying wallet address', async (): Promise<void> => {
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(123),
            assetCode: String.fromCharCode(
              ...asset.code
                .split('')
                .map((letter) => ((letter.charCodeAt(0) + 1 - 65) % 26) + 65)
            ),
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InvalidAmount)
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(123),
            assetCode: asset.code,
            assetScale: (asset.scale + 1) % 256
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InvalidAmount)
    })

    test('Cannot create incoming payment with non-positive amount', async (): Promise<void> => {
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(0),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InvalidAmount)
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(-13),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InvalidAmount)
    })

    test('Cannot create expired incoming payment', async (): Promise<void> => {
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(10),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() - 40_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InvalidExpiry)
    })

    test('Cannot create incoming payment with inactive wallet address', async (): Promise<void> => {
      const walletAddress = await WalletAddress.query(knex).patchAndFetchById(
        walletAddressId,
        { deactivatedAt: new Date() }
      )
      assert.ok(!walletAddress.isActive)
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(10),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InactiveWalletAddress)
    })

    test('Cannot create incoming payment with expiresAt greater than max', async (): Promise<void> => {
      await expect(
        incomingPaymentService.create({
          walletAddressId,
          incomingAmount: {
            value: BigInt(123),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(
            Date.now() + config.incomingPaymentExpiryMaxMs + 10_000
          ),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
      ).resolves.toBe(IncomingPaymentError.InvalidExpiry)
    })
  })
  describe('Update IncomingPayment', (): void => {
    let amount: Amount
    let payment: IncomingPayment

    beforeEach(async (): Promise<void> => {
      amount = {
        value: BigInt(123),
        assetCode: asset.code,
        assetScale: asset.scale
      }
      payment = (await incomingPaymentService.create({
        walletAddressId,
        incomingAmount: amount,
        tenantId
      })) as IncomingPayment
      assert.ok(!isIncomingPaymentError(payment))
    })

    test.each`
      metadata
      ${{ description: 'Update metadata', status: 'COMPLETE' }}
      ${{}}
    `(
      'An incoming payment can be updated',
      async ({ metadata }): Promise<void> => {
        const incomingPayment = await incomingPaymentService.update({
          id: payment.id,
          tenantId: Config.operatorTenantId,
          metadata
        })
        assert.ok(!isIncomingPaymentError(incomingPayment))
        expect(incomingPayment).toMatchObject({
          id: incomingPayment.id,
          metadata
        })
      }
    )

    test('Cannot update incoming payment for nonexistent incomingPaymentId', async (): Promise<void> => {
      await expect(
        incomingPaymentService.update({
          id: uuid(),
          tenantId: Config.operatorTenantId,
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          }
        })
      ).resolves.toBe(IncomingPaymentError.UnknownPayment)
    })
  })

  describe('get/getWalletAddressPage', (): void => {
    getTests({
      createModel: ({ client }) =>
        createIncomingPayment(deps, {
          walletAddressId,
          client,
          incomingAmount: {
            value: BigInt(123),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        }),
      get: (options) => incomingPaymentService.get(options),
      list: (options) => incomingPaymentService.getWalletAddressPage(options)
    })
  })

  describe('onCredit', (): void => {
    let incomingPayment: IncomingPayment

    beforeEach(async (): Promise<void> => {
      const incomingPaymentOrError = await incomingPaymentService.create({
        walletAddressId,
        incomingAmount: {
          value: BigInt(123),
          assetCode: asset.code,
          assetScale: asset.scale
        },
        expiresAt: new Date(Date.now() + 30_000),
        metadata: {
          description: 'Test incoming payment',
          externalRef: '#123'
        },
        tenantId
      })
      assert.ok(!isIncomingPaymentError(incomingPaymentOrError))
      incomingPayment = incomingPaymentOrError
    })

    test('Sets state of partially paid incoming payment to "processing"', async (): Promise<void> => {
      await expect(
        incomingPayment.onCredit({
          totalReceived: BigInt(100)
        })
      ).resolves.toMatchObject({
        id: incomingPayment.id,
        state: IncomingPaymentState.Processing,
        processAt: new Date(incomingPayment.expiresAt.getTime())
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Processing,
        processAt: new Date(incomingPayment.expiresAt.getTime())
      })
    })

    test('Sets state of fully paid incoming payment to "completed"', async (): Promise<void> => {
      const now = new Date()
      jest.useFakeTimers({ now })
      await expect(
        incomingPayment.onCredit({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          totalReceived: incomingPayment.incomingAmount!.value
        })
      ).resolves.toMatchObject({
        id: incomingPayment.id,
        state: IncomingPaymentState.Completed,
        processAt: now
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Completed,
        processAt: now
      })
    })
  })

  describe('processNext', (): void => {
    test('Does not process not-expired pending incoming payment', async (): Promise<void> => {
      const incomingPaymentOrError = await incomingPaymentService.create({
        walletAddressId,
        incomingAmount: {
          value: BigInt(123),
          assetCode: asset.code,
          assetScale: asset.scale
        },
        expiresAt: new Date(Date.now() + 30_000),
        metadata: {
          description: 'Test incoming payment',
          externalRef: '#123'
        },
        tenantId
      })
      assert.ok(!isIncomingPaymentError(incomingPaymentOrError))
      const incomingPaymentId = incomingPaymentOrError.id
      await expect(
        incomingPaymentService.processNext()
      ).resolves.toBeUndefined()
      await expect(
        incomingPaymentService.get({
          id: incomingPaymentId
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Pending
      })
    })

    describe('handleExpired', (): void => {
      test('Deactivates an expired incoming payment with received money', async (): Promise<void> => {
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId,
          incomingAmount: {
            value: BigInt(123),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
        await expect(
          accountingService.createDeposit({
            id: uuid(),
            account: incomingPayment,
            amount: BigInt(1)
          })
        ).resolves.toBeUndefined()

        jest.useFakeTimers()
        jest.setSystemTime(incomingPayment.expiresAt)
        await expect(incomingPaymentService.processNext()).resolves.toBe(
          incomingPayment.id
        )
        await expect(
          incomingPaymentService.get({
            id: incomingPayment.id
          })
        ).resolves.toMatchObject({
          state: IncomingPaymentState.Expired,
          processAt: new Date()
        })
      })

      test('Deletes an expired incoming payment (and account) with no money', async (): Promise<void> => {
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId,
          incomingAmount: {
            value: BigInt(123),
            assetCode: asset.code,
            assetScale: asset.scale
          },
          expiresAt: new Date(Date.now() + 30_000),
          metadata: {
            description: 'Test incoming payment',
            externalRef: '#123'
          },
          tenantId
        })
        jest.useFakeTimers()
        jest.setSystemTime(incomingPayment.expiresAt)
        await expect(incomingPaymentService.processNext()).resolves.toBe(
          incomingPayment.id
        )
        expect(
          await incomingPaymentService.get({
            id: incomingPayment.id
          })
        ).toBeUndefined()
      })
    })

    describe.each`
      eventType                                            | expiresAt                        | amountReceived
      ${IncomingPaymentEventType.IncomingPaymentExpired}   | ${new Date(Date.now() + 30_000)} | ${BigInt(1)}
      ${IncomingPaymentEventType.IncomingPaymentCompleted} | ${undefined}                     | ${BigInt(123)}
    `(
      'handleDeactivated ($eventType)',
      ({ eventType, expiresAt, amountReceived }): void => {
        let incomingPayment: IncomingPayment

        beforeEach(async (): Promise<void> => {
          incomingPayment = await createIncomingPayment(deps, {
            walletAddressId,
            client,
            incomingAmount: {
              value: BigInt(123),
              assetCode: asset.code,
              assetScale: asset.scale
            },
            expiresAt,
            metadata: {
              description: 'Test incoming payment',
              externalRef: '#123'
            },
            tenantId
          })
          await expect(
            accountingService.createDeposit({
              id: uuid(),
              account: incomingPayment,
              amount: amountReceived
            })
          ).resolves.toBeUndefined()
          if (eventType === IncomingPaymentEventType.IncomingPaymentExpired) {
            jest.useFakeTimers()
            jest.setSystemTime(incomingPayment.expiresAt)
            await expect(incomingPaymentService.processNext()).resolves.toBe(
              incomingPayment.id
            )
          } else {
            await incomingPayment.onCredit({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              totalReceived: incomingPayment.incomingAmount!.value
            })
          }
          incomingPayment = (await incomingPaymentService.get({
            id: incomingPayment.id
          })) as IncomingPayment
          expect(incomingPayment).toMatchObject({
            state:
              eventType === IncomingPaymentEventType.IncomingPaymentExpired
                ? IncomingPaymentState.Expired
                : IncomingPaymentState.Completed,
            processAt: expect.any(Date),
            client
          })
          await expect(
            accountingService.getTotalReceived(incomingPayment.id)
          ).resolves.toEqual(amountReceived)
          await expect(
            accountingService.getBalance(incomingPayment.id)
          ).resolves.toEqual(amountReceived)
        })

        test('Creates webhook event', async (): Promise<void> => {
          await expect(
            IncomingPaymentEvent.query(knex).where({
              type: eventType
            })
          ).resolves.toHaveLength(0)
          assert.ok(incomingPayment.processAt)
          jest.useFakeTimers()
          jest.setSystemTime(incomingPayment.processAt)
          await expect(incomingPaymentService.processNext()).resolves.toBe(
            incomingPayment.id
          )
          await expect(
            IncomingPaymentEvent.query(knex).where({
              incomingPaymentId: incomingPayment.id,
              type: eventType,
              withdrawalAccountId: incomingPayment.id,
              withdrawalAmount: amountReceived
            })
          ).resolves.toHaveLength(1)
          await expect(
            incomingPaymentService.get({
              id: incomingPayment.id
            })
          ).resolves.toMatchObject({
            processAt: null,
            client
          })
        })
      }
    )
  })

  describe('complete', (): void => {
    let incomingPayment: IncomingPayment

    beforeEach(async (): Promise<void> => {
      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId,
        incomingAmount: {
          value: BigInt(123),
          assetCode: asset.code,
          assetScale: asset.scale
        },
        expiresAt: new Date(Date.now() + 30_000),
        metadata: {
          description: 'Test incoming payment',
          externalRef: '#123'
        },
        tenantId
      })
    })
    test('updates state of pending incoming payment to complete', async (): Promise<void> => {
      const now = new Date()
      jest.useFakeTimers({ now })

      await expect(
        incomingPaymentService.complete(
          incomingPayment.id,
          Config.operatorTenantId
        )
      ).resolves.toMatchObject({
        id: incomingPayment.id,
        state: IncomingPaymentState.Completed,
        processAt: now,
        tenantId: Config.operatorTenantId
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Completed,
        processAt: now
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id,
          tenantId: Config.operatorTenantId
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Completed,
        processAt: now
      })
    })

    test('fails to complete unknown payment', async (): Promise<void> => {
      await expect(
        incomingPaymentService.complete(uuid(), Config.operatorTenantId)
      ).resolves.toEqual(IncomingPaymentError.UnknownPayment)
    })

    test('updates state of processing incoming payment to complete', async (): Promise<void> => {
      const now = new Date()
      jest.useFakeTimers({ now })

      await incomingPayment.onCredit({
        totalReceived: BigInt(100)
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Processing
      })
      await expect(
        incomingPaymentService.complete(
          incomingPayment.id,
          Config.operatorTenantId
        )
      ).resolves.toMatchObject({
        id: incomingPayment.id,
        state: IncomingPaymentState.Completed,
        processAt: now
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Completed,
        processAt: now
      })
    })

    test('fails to update state of expired incoming payment', async (): Promise<void> => {
      await expect(
        accountingService.createDeposit({
          id: uuid(),
          account: incomingPayment,
          amount: BigInt(1)
        })
      ).resolves.toBeUndefined()
      const future = new Date(Date.now() + 40_000)
      jest.useFakeTimers()
      jest.setSystemTime(future)
      await expect(incomingPaymentService.processNext()).resolves.toBe(
        incomingPayment.id
      )
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Expired
      })
      await expect(
        incomingPaymentService.complete(
          incomingPayment.id,
          Config.operatorTenantId
        )
      ).resolves.toBe(IncomingPaymentError.WrongState)
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Expired
      })
    })

    test('fails to update state of completed incoming payment', async (): Promise<void> => {
      await incomingPayment.onCredit({
        totalReceived: BigInt(123)
      })
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Completed
      })
      await expect(
        incomingPaymentService.complete(
          incomingPayment.id,
          Config.operatorTenantId
        )
      ).resolves.toBe(IncomingPaymentError.WrongState)
      await expect(
        incomingPaymentService.get({
          id: incomingPayment.id
        })
      ).resolves.toMatchObject({
        state: IncomingPaymentState.Completed
      })
    })
  })
})
