import { IocContract } from '@adonisjs/fold'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'
import {
  AuthenticatedClient,
  AccessType,
  AccessAction,
  IncomingPaymentWithPaymentMethods as OpenPaymentsIncomingPaymentWithPaymentMethods,
  WalletAddress as OpenPaymentsWalletAddress,
  mockWalletAddress,
  Grant as OpenPaymentsGrant,
  GrantRequest,
  mockIncomingPaymentWithPaymentMethods
} from '@interledger/open-payments'
import { v4 as uuid } from 'uuid'

import { ReceiverService } from './service'
import { createTestApp, TestContainer } from '../../tests/app'
import { Config } from '../../config/app'
import { initIocContainer } from '../..'
import { AppServices } from '../../app'
import { createIncomingPayment } from '../../tests/incomingPayment'
import {
  createWalletAddress,
  MockWalletAddress
} from '../../tests/walletAddress'
import { truncateTables } from '../../tests/tableManager'
import { GrantService } from '../grant/service'
import { WalletAddressService } from '../wallet_address/service'
import { Amount, parseAmount } from '../amount'
import { RemoteIncomingPaymentService } from '../payment/incoming_remote/service'
import { IncomingPaymentError } from '../payment/incoming/errors'
import { IncomingPaymentService } from '../payment/incoming/service'
import { createAsset } from '../../tests/asset'
import { ReceiverError } from './errors'
import { RemoteIncomingPaymentError } from '../payment/incoming_remote/errors'
import assert from 'assert'
import { Receiver } from './model'
import { Grant } from '../grant/model'
import { IncomingPaymentState } from '../payment/incoming/model'
import { PublicIncomingPayment } from '@interledger/open-payments/dist/types'
import { mockPublicIncomingPayment } from '@interledger/open-payments/dist/test/helpers'

describe('Receiver Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let receiverService: ReceiverService
  let incomingPaymentService: IncomingPaymentService
  let openPaymentsClient: AuthenticatedClient
  let knex: Knex
  let walletAddressService: WalletAddressService
  let grantService: GrantService
  let remoteIncomingPaymentService: RemoteIncomingPaymentService

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer(Config)
    appContainer = await createTestApp(deps)
    receiverService = await deps.use('receiverService')
    incomingPaymentService = await deps.use('incomingPaymentService')
    openPaymentsClient = await deps.use('openPaymentsClient')
    walletAddressService = await deps.use('walletAddressService')
    grantService = await deps.use('grantService')
    remoteIncomingPaymentService = await deps.use(
      'remoteIncomingPaymentService'
    )
    knex = appContainer.knex
  })

  afterEach(async (): Promise<void> => {
    jest.restoreAllMocks()
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('get', () => {
    describe('incoming payments', () => {
      test('resolves local incoming payment', async () => {
        const walletAddress = await createWalletAddress(deps, {
          mockServerPort: Config.openPaymentsPort
        })
        const incomingPayment = await createIncomingPayment(deps, {
          walletAddressId: walletAddress.id,
          incomingAmount: {
            value: BigInt(5),
            assetCode: walletAddress.asset.code,
            assetScale: walletAddress.asset.scale
          }
        })

        await expect(
          receiverService.get(incomingPayment.getUrl(walletAddress))
        ).resolves.toEqual({
          assetCode: incomingPayment.receivedAmount.assetCode,
          assetScale: incomingPayment.receivedAmount.assetScale,
          ilpAddress: expect.any(String),
          sharedSecret: expect.any(Buffer),
          incomingPayment: {
            id: incomingPayment.getUrl(walletAddress),
            walletAddress: walletAddress.url,
            completed: incomingPayment.completed,
            receivedAmount: incomingPayment.receivedAmount,
            incomingAmount: incomingPayment.incomingAmount,
            metadata: incomingPayment.metadata || undefined,
            expiresAt: incomingPayment.expiresAt,
            updatedAt: new Date(incomingPayment.updatedAt),
            createdAt: new Date(incomingPayment.createdAt),
            methods: [
              {
                type: 'ilp',
                ilpAddress: expect.any(String),
                sharedSecret: expect.any(String)
              }
            ]
          }
        })
      })

      describe.each`
        existingGrant | description
        ${false}      | ${'no grant'}
        ${true}       | ${'existing grant'}
      `('remote ($description)', ({ existingGrant }): void => {
        let walletAddress: OpenPaymentsWalletAddress
        let incomingPayment: OpenPaymentsIncomingPaymentWithPaymentMethods
        let publicIncomingPayment: PublicIncomingPayment
        const authServer = faker.internet.url({ appendSlash: false })
        const INCOMING_PAYMENT_PATH = 'incoming-payments'
        const grantOptions = {
          accessType: AccessType.IncomingPayment,
          accessActions: [AccessAction.ReadAll],
          accessToken: 'OZB8CDFONP219RP1LT0OS9M2PMHKUR64TB8N6BW7',
          managementUrl: `${authServer}/token/8f69de01-5bf9-4603-91ed-eeca101081f1`
        }
        const grantRequest: GrantRequest = {
          access_token: {
            access: [
              {
                type: grantOptions.accessType,
                actions: grantOptions.accessActions
              }
            ]
          },
          interact: {
            start: ['redirect']
          }
        } as GrantRequest
        const grant: OpenPaymentsGrant = {
          access_token: {
            value: grantOptions.accessToken,
            manage: grantOptions.managementUrl,
            expires_in: 3600,
            access: grantRequest.access_token.access
          },
          continue: {
            access_token: {
              value: '33OMUKMKSKU80UPRY5NM'
            },
            uri: `${authServer}/continue/4CF492MLVMSW9MKMXKHQ`,
            wait: 30
          }
        }
        const newToken = {
          access_token: {
            value: 'T0OS9M2PMHKUR64TB8N6BW7OZB8CDFONP219RP1L',
            manage: `${authServer}/token/d3f288c2-0b41-42f0-9b2f-66ff4bf45a7a`,
            expires_in: 3600,
            access: grantRequest.access_token.access
          }
        }

        beforeEach(async (): Promise<void> => {
          walletAddress = mockWalletAddress({
            authServer
          })
          incomingPayment = mockIncomingPaymentWithPaymentMethods({
            id: `${walletAddress.id}/incoming-payments/${uuid()}`,
            walletAddress: walletAddress.id
          })
          publicIncomingPayment = mockPublicIncomingPayment({
            authServer,
            receivedAmount: incomingPayment.receivedAmount
          })
          if (existingGrant) {
            await expect(
              grantService.create({
                ...grantOptions,
                authServer
              })
            ).resolves.toMatchObject({
              accessType: grantOptions.accessType,
              accessActions: grantOptions.accessActions,
              accessToken: grantOptions.accessToken,
              managementId: '8f69de01-5bf9-4603-91ed-eeca101081f1'
            })
          }
          jest
            .spyOn(walletAddressService, 'getByUrl')
            .mockResolvedValueOnce(undefined)
        })

        afterEach(() => {
          jest.restoreAllMocks()
        })

        test.each`
          rotate   | description
          ${false} | ${''}
          ${true}  | ${'- after rotating access token'}
        `('resolves incoming payment $description', async ({ rotate }) => {
          const clientRequestGrantSpy = jest
            .spyOn(openPaymentsClient.grant, 'request')
            .mockResolvedValueOnce(grant)

          const clientGetPublicIncomingPaymentSpy = jest
            .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
            .mockResolvedValueOnce(publicIncomingPayment)

          const clientGetIncomingPaymentSpy = jest
            .spyOn(openPaymentsClient.incomingPayment, 'get')
            .mockResolvedValueOnce(incomingPayment)

          const clientRequestRotateTokenSpy = jest
            .spyOn(openPaymentsClient.token, 'rotate')
            .mockResolvedValueOnce(newToken)

          if (existingGrant && rotate) {
            const fetchedGrant = await grantService.get({
              ...grantOptions,
              authServer
            })
            await fetchedGrant?.$query(knex).patch({ expiresAt: new Date() })
          }
          await expect(
            receiverService.get(incomingPayment.id)
          ).resolves.toEqual({
            assetCode: incomingPayment.receivedAmount.assetCode,
            assetScale: incomingPayment.receivedAmount.assetScale,
            ilpAddress: expect.any(String),
            sharedSecret: expect.any(Buffer),
            incomingPayment: {
              id: incomingPayment.id,
              walletAddress: incomingPayment.walletAddress,
              updatedAt: new Date(incomingPayment.updatedAt),
              createdAt: new Date(incomingPayment.createdAt),
              completed: incomingPayment.completed,
              receivedAmount:
                incomingPayment.receivedAmount &&
                parseAmount(incomingPayment.receivedAmount),
              incomingAmount:
                incomingPayment.incomingAmount &&
                parseAmount(incomingPayment.incomingAmount),
              expiresAt: incomingPayment.expiresAt,
              methods: [
                {
                  type: 'ilp',
                  ilpAddress: expect.any(String),
                  sharedSecret: expect.any(String)
                }
              ]
            }
          })
          if (!existingGrant) {
            expect(clientRequestGrantSpy).toHaveBeenCalledWith(
              { url: authServer },
              grantRequest
            )
          }
          expect(clientGetPublicIncomingPaymentSpy).toHaveBeenCalledWith({
            url: incomingPayment.id
          })
          expect(clientGetIncomingPaymentSpy).toHaveBeenCalledWith({
            url: incomingPayment.id,
            accessToken:
              existingGrant && rotate
                ? newToken.access_token.value
                : grantOptions.accessToken
          })
          if (existingGrant && rotate) {
            expect(clientRequestRotateTokenSpy).toHaveBeenCalledWith({
              url: grant.access_token.manage,
              accessToken: grantOptions.accessToken
            })
          }
        })

        test('returns undefined for invalid remote public incoming payment', async (): Promise<void> => {
          const clientGetPublicIncomingPaymentSpy = jest
            .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
            .mockRejectedValueOnce({ status: 404 })

          await expect(
            receiverService.get(
              `${
                new URL(incomingPayment.id).origin
              }/${INCOMING_PAYMENT_PATH}/${uuid()}`
            )
          ).resolves.toBeUndefined()
          expect(clientGetPublicIncomingPaymentSpy).toHaveBeenCalledTimes(1)
        })

        if (existingGrant) {
          test('returns undefined for invalid remote auth server', async (): Promise<void> => {
            const grant = await grantService.get({
              ...grantOptions,
              authServer
            })
            assert.ok(grant)
            const getExistingGrantSpy = jest
              .spyOn(grantService, 'get')
              .mockResolvedValueOnce({
                ...grant,
                authServer: undefined,
                expired: true
              } as Grant)
            jest
              .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
              .mockResolvedValueOnce(publicIncomingPayment)
            const clientRequestGrantSpy = jest.spyOn(
              openPaymentsClient.grant,
              'request'
            )

            await expect(
              receiverService.get(incomingPayment.id)
            ).resolves.toBeUndefined()
            expect(getExistingGrantSpy).toHaveBeenCalled()
            expect(clientRequestGrantSpy).not.toHaveBeenCalled()
          })
          test('returns undefined for expired grant that cannot be rotated', async (): Promise<void> => {
            const grant = await grantService.get({
              ...grantOptions,
              authServer
            })
            await grant?.$query(knex).patch({ expiresAt: new Date() })
            jest
              .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
              .mockResolvedValueOnce(publicIncomingPayment)
            const clientRequestGrantSpy = jest.spyOn(
              openPaymentsClient.grant,
              'request'
            )

            await expect(
              receiverService.get(incomingPayment.id)
            ).resolves.toBeUndefined()
            expect(clientRequestGrantSpy).not.toHaveBeenCalled()
          })
        } else {
          test('returns undefined for invalid grant', async (): Promise<void> => {
            jest
              .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
              .mockResolvedValueOnce(publicIncomingPayment)
            const clientRequestGrantSpy = jest
              .spyOn(openPaymentsClient.grant, 'request')
              .mockRejectedValueOnce(new Error('Could not request grant'))

            await expect(
              receiverService.get(incomingPayment.id)
            ).resolves.toBeUndefined()
            expect(clientRequestGrantSpy).toHaveBeenCalledWith(
              { url: authServer },
              grantRequest
            )
          })

          test('returns undefined for interactive grant', async (): Promise<void> => {
            jest
              .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
              .mockResolvedValueOnce(publicIncomingPayment)
            const clientRequestGrantSpy = jest
              .spyOn(openPaymentsClient.grant, 'request')
              .mockResolvedValueOnce({
                continue: grant.continue,
                interact: {
                  redirect: `${authServer}/4CF492MLVMSW9MKMXKHQ`,
                  finish: 'MBDOFXG4Y5CVJCX821LH'
                }
              })

            await expect(
              receiverService.get(incomingPayment.id)
            ).resolves.toBeUndefined()
            expect(clientRequestGrantSpy).toHaveBeenCalledWith(
              { url: authServer },
              grantRequest
            )
          })
        }

        test('returns undefined when fetching remote incoming payment throws', async (): Promise<void> => {
          jest
            .spyOn(openPaymentsClient.incomingPayment, 'getPublic')
            .mockResolvedValueOnce(publicIncomingPayment)
          jest
            .spyOn(openPaymentsClient.grant, 'request')
            .mockResolvedValueOnce(grant)
          const clientGetIncomingPaymentSpy = jest
            .spyOn(openPaymentsClient.incomingPayment, 'get')
            .mockRejectedValueOnce(new Error('Could not get incoming payment'))

          await expect(
            receiverService.get(incomingPayment.id)
          ).resolves.toBeUndefined()
          expect(clientGetIncomingPaymentSpy).toHaveBeenCalledWith({
            url: incomingPayment.id,
            accessToken: expect.any(String)
          })
        })
      })
    })
  })

  describe('create', () => {
    describe('remote incoming payment', () => {
      const walletAddress = mockWalletAddress({
        assetCode: 'USD',
        assetScale: 2
      })

      const amount: Amount = {
        value: BigInt(123),
        assetCode: 'USD',
        assetScale: 2
      }

      test.each`
        incomingAmount | expiresAt                        | metadata
        ${undefined}   | ${undefined}                     | ${undefined}
        ${amount}      | ${new Date(Date.now() + 30_000)} | ${{ description: 'Test incoming payment', externalRef: '#123' }}
      `(
        'creates receiver from remote incoming payment ($#)',
        async ({ metadata, expiresAt, incomingAmount }): Promise<void> => {
          const incomingPayment = mockIncomingPaymentWithPaymentMethods({
            metadata,
            expiresAt,
            incomingAmount
          })
          const remoteIncomingPaymentServiceSpy = jest
            .spyOn(remoteIncomingPaymentService, 'create')
            .mockResolvedValueOnce(incomingPayment)

          const localIncomingPaymentCreateSpy = jest.spyOn(
            incomingPaymentService,
            'create'
          )

          const receiver = await receiverService.create({
            walletAddressUrl: walletAddress.id,
            incomingAmount,
            expiresAt,
            metadata
          })

          expect(receiver).toEqual({
            assetCode: incomingPayment.receivedAmount.assetCode,
            assetScale: incomingPayment.receivedAmount.assetScale,
            ilpAddress: incomingPayment.methods[0].ilpAddress,
            sharedSecret: expect.any(Buffer),
            incomingPayment: {
              id: incomingPayment.id,
              walletAddress: incomingPayment.walletAddress,
              completed: incomingPayment.completed,
              receivedAmount: parseAmount(incomingPayment.receivedAmount),
              incomingAmount:
                incomingPayment.incomingAmount &&
                parseAmount(incomingPayment.incomingAmount),
              metadata: incomingPayment.metadata || undefined,
              updatedAt: new Date(incomingPayment.updatedAt),
              createdAt: new Date(incomingPayment.createdAt),
              expiresAt:
                incomingPayment.expiresAt &&
                new Date(incomingPayment.expiresAt),
              methods: [
                {
                  type: 'ilp',
                  ilpAddress: incomingPayment.methods[0].ilpAddress,
                  sharedSecret: expect.any(String)
                }
              ]
            }
          })

          expect(remoteIncomingPaymentServiceSpy).toHaveBeenCalledWith({
            walletAddressUrl: walletAddress.id,
            incomingAmount,
            expiresAt,
            metadata
          })
          expect(localIncomingPaymentCreateSpy).not.toHaveBeenCalled()
        }
      )

      test('returns error if could not create remote incoming payment', async (): Promise<void> => {
        jest
          .spyOn(remoteIncomingPaymentService, 'create')
          .mockResolvedValueOnce(
            RemoteIncomingPaymentError.UnknownWalletAddress
          )

        await expect(
          receiverService.create({
            walletAddressUrl: walletAddress.id
          })
        ).resolves.toEqual(ReceiverError.UnknownWalletAddress)
      })
    })

    describe('local incoming payment', () => {
      let walletAddress: MockWalletAddress
      const amount: Amount = {
        value: BigInt(123),
        assetCode: 'USD',
        assetScale: 2
      }

      beforeEach(async () => {
        const asset = await createAsset(deps, {
          code: 'USD',
          scale: 2
        })

        walletAddress = await createWalletAddress(deps, {
          mockServerPort: Config.openPaymentsPort,
          assetId: asset.id
        })
      })

      test.each`
        incomingAmount | expiresAt                        | metadata
        ${undefined}   | ${undefined}                     | ${undefined}
        ${amount}      | ${new Date(Date.now() + 30_000)} | ${{ description: 'Test incoming payment', externalRef: '#123' }}
      `(
        'creates receiver from local incoming payment ($#)',
        async ({ metadata, expiresAt, incomingAmount }): Promise<void> => {
          const incomingPaymentCreateSpy = jest.spyOn(
            incomingPaymentService,
            'create'
          )
          const remoteIncomingPaymentCreateSpy = jest.spyOn(
            remoteIncomingPaymentService,
            'create'
          )
          const receiver = await receiverService.create({
            walletAddressUrl: walletAddress.url,
            incomingAmount,
            expiresAt,
            metadata
          })

          assert(receiver instanceof Receiver)
          expect(receiver).toEqual({
            assetCode: walletAddress.asset.code,
            assetScale: walletAddress.asset.scale,
            ilpAddress: receiver.ilpAddress,
            sharedSecret: expect.any(Buffer),
            incomingPayment: {
              id: receiver.incomingPayment?.id,
              walletAddress: receiver.incomingPayment?.walletAddress,
              completed: receiver.incomingPayment?.completed,
              receivedAmount: receiver.incomingPayment?.receivedAmount,
              incomingAmount: receiver.incomingPayment?.incomingAmount,
              metadata: receiver.incomingPayment?.metadata || undefined,
              updatedAt: receiver.incomingPayment?.updatedAt,
              createdAt: receiver.incomingPayment?.createdAt,
              expiresAt: receiver.incomingPayment?.expiresAt,
              methods: [
                {
                  type: 'ilp',
                  ilpAddress: receiver.ilpAddress,
                  sharedSecret: expect.any(String)
                }
              ]
            }
          })

          expect(incomingPaymentCreateSpy).toHaveBeenCalledWith({
            walletAddressId: walletAddress.id,
            incomingAmount,
            expiresAt,
            metadata
          })
          expect(remoteIncomingPaymentCreateSpy).not.toHaveBeenCalled()
        }
      )

      test('returns error if could not create local incoming payment', async (): Promise<void> => {
        jest
          .spyOn(incomingPaymentService, 'create')
          .mockResolvedValueOnce(IncomingPaymentError.InvalidAmount)

        await expect(
          receiverService.create({
            walletAddressUrl: walletAddress.url
          })
        ).resolves.toEqual(ReceiverError.InvalidAmount)
      })

      test.each([IncomingPaymentState.Completed, IncomingPaymentState.Expired])(
        'throws if local incoming payment state is %s',
        async (paymentState): Promise<void> => {
          const incomingPayment = await createIncomingPayment(deps, {
            walletAddressId: walletAddress.id,
            incomingAmount: {
              value: BigInt(5),
              assetCode: walletAddress.asset.code,
              assetScale: walletAddress.asset.scale
            }
          })
          incomingPayment.state = paymentState
          jest
            .spyOn(incomingPaymentService, 'create')
            .mockResolvedValueOnce(incomingPayment)

          await expect(
            receiverService.create({
              walletAddressUrl: walletAddress.url
            })
          ).rejects.toThrow(
            'Could not get stream credentials for local incoming payment'
          )
        }
      )
    })
  })
})
