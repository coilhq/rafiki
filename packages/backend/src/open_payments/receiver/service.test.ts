import { IocContract } from '@adonisjs/fold'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'
import {
  AuthenticatedClient,
  AccessType,
  AccessAction,
  IncomingPayment as OpenPaymentsIncomingPayment,
  PaymentPointer as OpenPaymentsPaymentPointer,
  mockPaymentPointer,
  NonInteractiveGrant,
  GrantRequest,
  mockIncomingPaymentWithConnection
} from 'open-payments'
import { URL } from 'url'
import { v4 as uuid } from 'uuid'

import { ReceiverService } from './service'
import { createTestApp, TestContainer } from '../../tests/app'
import { Config } from '../../config/app'
import { initIocContainer } from '../..'
import { AppServices } from '../../app'
import { createIncomingPayment } from '../../tests/incomingPayment'
import {
  createPaymentPointer,
  MockPaymentPointer
} from '../../tests/paymentPointer'
import { truncateTables } from '../../tests/tableManager'
import { ConnectionService } from '../connection/service'
import { GrantService } from '../grant/service'
import { PaymentPointerService } from '../payment_pointer/service'
import { Amount, parseAmount } from '../amount'
import { RemoteIncomingPaymentService } from '../payment/incoming_remote/service'
import { Connection } from '../connection/model'
import { IncomingPaymentError } from '../payment/incoming/errors'
import { IncomingPaymentService } from '../payment/incoming/service'
import { createAsset } from '../../tests/asset'
import { ReceiverError } from './errors'
import { RemoteIncomingPaymentError } from '../payment/incoming_remote/errors'
import assert from 'assert'
import { Receiver } from './model'

describe('Receiver Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let receiverService: ReceiverService
  let incomingPaymentService: IncomingPaymentService
  let openPaymentsClient: AuthenticatedClient
  let knex: Knex
  let connectionService: ConnectionService
  let paymentPointerService: PaymentPointerService
  let grantService: GrantService
  let remoteIncomingPaymentService: RemoteIncomingPaymentService

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer(Config)
    appContainer = await createTestApp(deps, { silentLogging: true })
    receiverService = await deps.use('receiverService')
    incomingPaymentService = await deps.use('incomingPaymentService')
    openPaymentsClient = await deps.use('openPaymentsClient')
    connectionService = await deps.use('connectionService')
    paymentPointerService = await deps.use('paymentPointerService')
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
    describe('connections', () => {
      const CONNECTION_PATH = 'connections'

      test('resolves local connection', async () => {
        const paymentPointer = await createPaymentPointer(deps, {
          mockServerPort: Config.openPaymentsPort
        })
        const { connectionId } = await createIncomingPayment(deps, {
          paymentPointerId: paymentPointer.id
        })

        const localUrl = `${Config.openPaymentsUrl}/${CONNECTION_PATH}/${connectionId}`

        const clientGetConnectionSpy = jest.spyOn(
          openPaymentsClient.ilpStreamConnection,
          'get'
        )

        await expect(receiverService.get(localUrl)).resolves.toEqual({
          assetCode: paymentPointer.asset.code,
          assetScale: paymentPointer.asset.scale,
          incomingAmount: undefined,
          receivedAmount: undefined,
          ilpAddress: expect.any(String),
          sharedSecret: expect.any(Buffer),
          expiresAt: undefined
        })
        expect(clientGetConnectionSpy).not.toHaveBeenCalled()
      })

      test('resolves remote connection', async () => {
        const paymentPointer = await createPaymentPointer(deps)
        const incomingPayment = await createIncomingPayment(deps, {
          paymentPointerId: paymentPointer.id
        })

        const remoteUrl = new URL(
          `${paymentPointer.url}/${CONNECTION_PATH}/${incomingPayment.connectionId}`
        )

        const connection = connectionService.get(incomingPayment)

        assert(connection instanceof Connection)

        const clientGetConnectionSpy = jest
          .spyOn(openPaymentsClient.ilpStreamConnection, 'get')
          .mockImplementationOnce(async () => connection.toOpenPaymentsType())

        await expect(receiverService.get(remoteUrl.href)).resolves.toEqual({
          assetCode: paymentPointer.asset.code,
          assetScale: paymentPointer.asset.scale,
          incomingAmount: undefined,
          receivedAmount: undefined,
          ilpAddress: expect.any(String),
          sharedSecret: expect.any(Buffer),
          expiresAt: undefined
        })
        expect(clientGetConnectionSpy).toHaveBeenCalledWith({
          url: remoteUrl.href
        })
      })

      test('returns undefined for unknown local connection', async (): Promise<void> => {
        const paymentPointer = await createPaymentPointer(deps)

        await expect(
          receiverService.get(
            `${paymentPointer.url}/${CONNECTION_PATH}/${uuid()}`
          )
        ).resolves.toBeUndefined()
      })

      test('returns undefined when fetching remote connection throws', async (): Promise<void> => {
        const paymentPointer = await createPaymentPointer(deps)
        const incomingPayment = await createIncomingPayment(deps, {
          paymentPointerId: paymentPointer.id
        })

        const remoteUrl = new URL(
          `${paymentPointer.url}/${CONNECTION_PATH}/${incomingPayment.connectionId}`
        )

        const clientGetConnectionSpy = jest
          .spyOn(openPaymentsClient.ilpStreamConnection, 'get')
          .mockImplementationOnce(async () => {
            throw new Error('Could not get connection')
          })

        await expect(
          receiverService.get(remoteUrl.href)
        ).resolves.toBeUndefined()
        expect(clientGetConnectionSpy).toHaveBeenCalledWith({
          url: remoteUrl.href
        })
      })
    })

    describe('incoming payments', () => {
      test('resolves local incoming payment', async () => {
        const paymentPointer = await createPaymentPointer(deps, {
          mockServerPort: Config.openPaymentsPort
        })
        const incomingPayment = await createIncomingPayment(deps, {
          paymentPointerId: paymentPointer.id,
          incomingAmount: {
            value: BigInt(5),
            assetCode: paymentPointer.asset.code,
            assetScale: paymentPointer.asset.scale
          }
        })

        const clientGetIncomingPaymentSpy = jest.spyOn(
          openPaymentsClient.ilpStreamConnection,
          'get'
        )

        await expect(
          receiverService.get(incomingPayment.getUrl(paymentPointer))
        ).resolves.toEqual({
          assetCode: incomingPayment.receivedAmount.assetCode,
          assetScale: incomingPayment.receivedAmount.assetScale,
          ilpAddress: expect.any(String),
          sharedSecret: expect.any(Buffer),
          incomingPayment: {
            id: incomingPayment.getUrl(paymentPointer),
            paymentPointer: paymentPointer.url,
            completed: incomingPayment.completed,
            receivedAmount: incomingPayment.receivedAmount,
            incomingAmount: incomingPayment.incomingAmount,
            description: incomingPayment.description || undefined,
            externalRef: incomingPayment.externalRef || undefined,
            expiresAt: incomingPayment.expiresAt,
            updatedAt: new Date(incomingPayment.updatedAt),
            createdAt: new Date(incomingPayment.createdAt)
          }
        })
        expect(clientGetIncomingPaymentSpy).not.toHaveBeenCalled()
      })

      describe.each`
        existingGrant | description
        ${false}      | ${'no grant'}
        ${true}       | ${'existing grant'}
      `('remote ($description)', ({ existingGrant }): void => {
        let paymentPointer: OpenPaymentsPaymentPointer
        let incomingPayment: OpenPaymentsIncomingPayment
        const authServer = faker.internet.url()
        const INCOMING_PAYMENT_PATH = 'incoming-payments'
        const grantOptions = {
          accessType: AccessType.IncomingPayment,
          accessActions: [AccessAction.ReadAll],
          accessToken: 'OZB8CDFONP219RP1LT0OS9M2PMHKUR64TB8N6BW7'
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
        const grant: NonInteractiveGrant = {
          access_token: {
            value: grantOptions.accessToken,
            manage: `${authServer}/token/8f69de01-5bf9-4603-91ed-eeca101081f1`,
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

        beforeEach(async (): Promise<void> => {
          paymentPointer = mockPaymentPointer({
            authServer
          })
          incomingPayment = mockIncomingPaymentWithConnection({
            id: `${paymentPointer.id}/incoming-payments/${uuid()}`,
            paymentPointer: paymentPointer.id
          })
          if (existingGrant) {
            await expect(
              grantService.create({
                ...grantOptions,
                authServer
              })
            ).resolves.toMatchObject(grantOptions)
          }
          jest
            .spyOn(paymentPointerService, 'getByUrl')
            .mockResolvedValueOnce(undefined)
        })

        test('resolves incoming payment', async () => {
          const clientGetPaymentPointerSpy = jest
            .spyOn(openPaymentsClient.paymentPointer, 'get')
            .mockResolvedValueOnce(paymentPointer)

          const clientRequestGrantSpy = jest
            .spyOn(openPaymentsClient.grant, 'request')
            .mockResolvedValueOnce(grant)

          const clientGetIncomingPaymentSpy = jest
            .spyOn(openPaymentsClient.incomingPayment, 'get')
            .mockResolvedValueOnce(incomingPayment)

          await expect(
            receiverService.get(incomingPayment.id)
          ).resolves.toEqual({
            assetCode: incomingPayment.receivedAmount.assetCode,
            assetScale: incomingPayment.receivedAmount.assetScale,
            ilpAddress: expect.any(String),
            sharedSecret: expect.any(Buffer),
            incomingPayment: {
              id: incomingPayment.id,
              paymentPointer: incomingPayment.paymentPointer,
              updatedAt: new Date(incomingPayment.updatedAt),
              createdAt: new Date(incomingPayment.createdAt),
              completed: incomingPayment.completed,
              receivedAmount:
                incomingPayment.receivedAmount &&
                parseAmount(incomingPayment.receivedAmount),
              incomingAmount:
                incomingPayment.incomingAmount &&
                parseAmount(incomingPayment.incomingAmount),
              expiresAt: incomingPayment.expiresAt
            }
          })
          expect(clientGetPaymentPointerSpy).toHaveBeenCalledWith({
            url: paymentPointer.id
          })
          if (!existingGrant) {
            expect(clientRequestGrantSpy).toHaveBeenCalledWith(
              { url: authServer },
              grantRequest
            )
          }
          expect(clientGetIncomingPaymentSpy).toHaveBeenCalledWith({
            url: incomingPayment.id,
            accessToken: grantOptions.accessToken
          })
        })

        test('returns undefined for invalid remote incoming payment payment pointer', async (): Promise<void> => {
          const clientGetPaymentPointerSpy = jest
            .spyOn(openPaymentsClient.paymentPointer, 'get')
            .mockRejectedValueOnce(new Error('Could not get payment pointer'))

          await expect(
            receiverService.get(
              `${paymentPointer.id}/${INCOMING_PAYMENT_PATH}/${uuid()}`
            )
          ).resolves.toBeUndefined()
          expect(clientGetPaymentPointerSpy).toHaveBeenCalledWith({
            url: paymentPointer.id
          })
        })

        if (existingGrant) {
          test('returns undefined for expired grant', async (): Promise<void> => {
            const grant = await grantService.get({
              ...grantOptions,
              authServer
            })
            await grant?.$query(knex).patch({ expiresAt: new Date() })
            jest
              .spyOn(openPaymentsClient.paymentPointer, 'get')
              .mockResolvedValueOnce(paymentPointer)
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
              .spyOn(openPaymentsClient.paymentPointer, 'get')
              .mockResolvedValueOnce(paymentPointer)
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
              .spyOn(openPaymentsClient.paymentPointer, 'get')
              .mockResolvedValueOnce(paymentPointer)
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
            .spyOn(openPaymentsClient.paymentPointer, 'get')
            .mockResolvedValueOnce(paymentPointer)
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
      const paymentPointer = mockPaymentPointer({
        assetCode: 'USD',
        assetScale: 2
      })

      const amount: Amount = {
        value: BigInt(123),
        assetCode: 'USD',
        assetScale: 2
      }

      test.each`
        incomingAmount | expiresAt                        | description                | externalRef
        ${undefined}   | ${undefined}                     | ${undefined}               | ${undefined}
        ${amount}      | ${new Date(Date.now() + 30_000)} | ${'Test incoming payment'} | ${'#123'}
      `(
        'creates receiver from remote incoming payment ($#)',
        async ({
          description,
          externalRef,
          expiresAt,
          incomingAmount
        }): Promise<void> => {
          const incomingPayment = mockIncomingPaymentWithConnection({
            description,
            externalRef,
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
            paymentPointerUrl: paymentPointer.id,
            incomingAmount,
            expiresAt,
            description,
            externalRef
          })

          expect(receiver).toEqual({
            assetCode: incomingPayment.receivedAmount.assetCode,
            assetScale: incomingPayment.receivedAmount.assetScale,
            ilpAddress: incomingPayment.ilpStreamConnection?.ilpAddress,
            sharedSecret: expect.any(Buffer),
            incomingPayment: {
              id: incomingPayment.id,
              paymentPointer: incomingPayment.paymentPointer,
              completed: incomingPayment.completed,
              receivedAmount: parseAmount(incomingPayment.receivedAmount),
              incomingAmount:
                incomingPayment.incomingAmount &&
                parseAmount(incomingPayment.incomingAmount),
              description: incomingPayment.description || undefined,
              externalRef: incomingPayment.externalRef || undefined,
              updatedAt: new Date(incomingPayment.updatedAt),
              createdAt: new Date(incomingPayment.createdAt),
              expiresAt:
                incomingPayment.expiresAt && new Date(incomingPayment.expiresAt)
            }
          })

          expect(remoteIncomingPaymentServiceSpy).toHaveBeenCalledWith({
            paymentPointerUrl: paymentPointer.id,
            incomingAmount,
            expiresAt,
            description,
            externalRef
          })
          expect(localIncomingPaymentCreateSpy).not.toHaveBeenCalled()
        }
      )

      test('returns error if could not create remote incoming payment', async (): Promise<void> => {
        jest
          .spyOn(remoteIncomingPaymentService, 'create')
          .mockResolvedValueOnce(
            RemoteIncomingPaymentError.UnknownPaymentPointer
          )

        await expect(
          receiverService.create({
            paymentPointerUrl: paymentPointer.id
          })
        ).resolves.toEqual(ReceiverError.UnknownPaymentPointer)
      })
    })

    describe('local incoming payment', () => {
      let paymentPointer: MockPaymentPointer
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

        paymentPointer = await createPaymentPointer(deps, {
          mockServerPort: Config.openPaymentsPort,
          assetId: asset.id
        })
      })

      test.each`
        incomingAmount | expiresAt                        | description                | externalRef
        ${undefined}   | ${undefined}                     | ${undefined}               | ${undefined}
        ${amount}      | ${new Date(Date.now() + 30_000)} | ${'Test incoming payment'} | ${'#123'}
      `(
        'creates receiver from local incoming payment ($#)',
        async ({
          description,
          externalRef,
          expiresAt,
          incomingAmount
        }): Promise<void> => {
          const incomingPaymentCreateSpy = jest.spyOn(
            incomingPaymentService,
            'create'
          )
          const remoteIncomingPaymentCreateSpy = jest.spyOn(
            remoteIncomingPaymentService,
            'create'
          )
          const receiver = await receiverService.create({
            paymentPointerUrl: paymentPointer.url,
            incomingAmount,
            expiresAt,
            description,
            externalRef
          })

          assert(receiver instanceof Receiver)
          expect(receiver).toEqual({
            assetCode: paymentPointer.asset.code,
            assetScale: paymentPointer.asset.scale,
            ilpAddress: receiver.ilpAddress,
            sharedSecret: expect.any(Buffer),
            incomingPayment: {
              id: receiver.incomingPayment?.id,
              paymentPointer: receiver.incomingPayment?.paymentPointer,
              completed: receiver.incomingPayment?.completed,
              receivedAmount: receiver.incomingPayment?.receivedAmount,
              incomingAmount: receiver.incomingPayment?.incomingAmount,
              description: receiver.incomingPayment?.description || undefined,
              externalRef: receiver.incomingPayment?.externalRef || undefined,
              updatedAt: receiver.incomingPayment?.updatedAt,
              createdAt: receiver.incomingPayment?.createdAt,
              expiresAt: receiver.incomingPayment?.expiresAt
            }
          })

          expect(incomingPaymentCreateSpy).toHaveBeenCalledWith({
            paymentPointerId: paymentPointer.id,
            incomingAmount,
            expiresAt,
            description,
            externalRef
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
            paymentPointerUrl: paymentPointer.url
          })
        ).resolves.toEqual(ReceiverError.InvalidAmount)
      })

      test('throws if error when getting connection for local incoming payment', async (): Promise<void> => {
        jest.spyOn(connectionService, 'get').mockReturnValueOnce(undefined)

        await expect(
          receiverService.create({
            paymentPointerUrl: paymentPointer.url
          })
        ).rejects.toThrow('Could not get connection for local incoming payment')
      })
    })
  })
})
