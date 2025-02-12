import { ApolloError, gql } from '@apollo/client'
import { getPageTests } from './page.test'
import { createTestApp, TestContainer } from '../../tests/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { initIocContainer } from '../..'
import { Asset } from '../../asset/model'
import { Config } from '../../config/app'
import { createAsset } from '../../tests/asset'
import { createIncomingPayment } from '../../tests/incomingPayment'
import { createWalletAddress } from '../../tests/walletAddress'
import { truncateTables } from '../../tests/tableManager'
import { v4 as uuid } from 'uuid'
import { IncomingPaymentService } from '../../open_payments/payment/incoming/service'
import { AccountingService } from '../../accounting/service'
import {
  IncomingPayment as IncomingPaymentModel,
  IncomingPaymentState
} from '../../open_payments/payment/incoming/model'
import {
  IncomingPayment,
  IncomingPaymentResponse,
  IncomingPaymentState as SchemaPaymentState
} from '../generated/graphql'
import {
  IncomingPaymentError,
  errorToMessage,
  errorToCode
} from '../../open_payments/payment/incoming/errors'
import { Amount, serializeAmount } from '../../open_payments/amount'
import { GraphQLErrorCode } from '../errors'

describe('Incoming Payment Resolver', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let walletAddressId: string
  let client: string
  let incomingPaymentService: IncomingPaymentService
  let accountingService: AccountingService
  let asset: Asset
  let tenantId: string

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    appContainer = await createTestApp(deps)
    incomingPaymentService = await deps.use('incomingPaymentService')
    accountingService = await deps.use('accountingService')
    asset = await createAsset(deps)
    tenantId = Config.operatorTenantId
  })

  afterAll(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
    await appContainer.apolloClient.stop()
    await appContainer.shutdown()
  })

  describe('Wallet address incoming payments', (): void => {
    beforeEach(async (): Promise<void> => {
      walletAddressId = (
        await createWalletAddress(deps, {
          tenantId: Config.operatorTenantId,
          assetId: asset.id
        })
      ).id
    })

    getPageTests({
      getClient: () => appContainer.apolloClient,
      createModel: () =>
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
            description: `IncomingPayment`,
            externalRef: '#123'
          },
          tenantId
        }),
      pagedQuery: 'incomingPayments',
      parent: {
        query: 'walletAddress',
        getId: () => walletAddressId
      }
    })
  })

  describe('Mutation.createIncomingPayment', (): void => {
    let amount: Amount

    beforeEach((): void => {
      amount = {
        value: BigInt(56),
        assetCode: asset.code,
        assetScale: asset.scale
      }
      client = 'incoming-payment-client-create'
    })

    test.each`
      metadata                                          | expiresAt                        | withAmount | desc
      ${{ description: 'rent', externalRef: '202201' }} | ${undefined}                     | ${false}   | ${'metadata'}
      ${undefined}                                      | ${new Date(Date.now() + 30_000)} | ${false}   | ${'expiresAt'}
      ${undefined}                                      | ${undefined}                     | ${true}    | ${'incomingAmount'}
    `(
      'Successfully creates an incoming payment with $desc',
      async ({ metadata, expiresAt, withAmount }): Promise<void> => {
        const incomingAmount = withAmount ? amount : undefined
        const { id: walletAddressId } = await createWalletAddress(deps, {
          tenantId: Config.operatorTenantId,
          assetId: asset.id
        })
        const payment = await createIncomingPayment(deps, {
          walletAddressId,
          client,
          metadata,
          expiresAt,
          incomingAmount,
          tenantId
        })

        const createSpy = jest
          .spyOn(incomingPaymentService, 'create')
          .mockResolvedValueOnce(payment)

        const input = {
          walletAddressId,
          incomingAmount,
          expiresAt,
          metadata
        }

        const query = await appContainer.apolloClient
          .query({
            query: gql`
              mutation CreateIncomingPayment(
                $input: CreateIncomingPaymentInput!
              ) {
                createIncomingPayment(input: $input) {
                  payment {
                    id
                    walletAddressId
                    state
                    expiresAt
                    incomingAmount {
                      value
                      assetCode
                      assetScale
                    }
                    receivedAmount {
                      value
                      assetCode
                      assetScale
                    }
                    metadata
                    createdAt
                  }
                }
              }
            `,
            variables: { input }
          })
          .then(
            (query): IncomingPaymentResponse =>
              query.data?.createIncomingPayment
          )

        expect(createSpy).toHaveBeenCalledWith({ ...input, tenantId })
        expect(query).toEqual({
          __typename: 'IncomingPaymentResponse',
          payment: {
            __typename: 'IncomingPayment',
            id: payment.id,
            walletAddressId,
            state: SchemaPaymentState.Pending,
            expiresAt:
              expiresAt?.toISOString() || payment.expiresAt.toISOString(),
            incomingAmount:
              incomingAmount === undefined
                ? null
                : {
                    __typename: 'Amount',
                    ...serializeAmount(incomingAmount)
                  },
            receivedAmount: {
              __typename: 'Amount',
              ...serializeAmount(payment.receivedAmount)
            },
            metadata: metadata || null,
            createdAt: payment.createdAt.toISOString()
          }
        })
      }
    )

    test('Errors when unknown wallet address', async (): Promise<void> => {
      const createSpy = jest
        .spyOn(incomingPaymentService, 'create')
        .mockResolvedValueOnce(IncomingPaymentError.UnknownWalletAddress)

      const input = {
        walletAddressId: uuid()
      }

      expect.assertions(3)
      try {
        await appContainer.apolloClient
          .query({
            query: gql`
              mutation CreateIncomingPayment(
                $input: CreateIncomingPaymentInput!
              ) {
                createIncomingPayment(input: $input) {
                  payment {
                    id
                    state
                  }
                }
              }
            `,
            variables: { input }
          })
          .then(
            (query): IncomingPaymentResponse =>
              query.data?.createIncomingPayment
          )
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: errorToMessage[IncomingPaymentError.UnknownWalletAddress],
            extensions: expect.objectContaining({
              code: errorToCode[IncomingPaymentError.UnknownWalletAddress]
            })
          })
        )
      }
      expect(createSpy).toHaveBeenCalledWith({ ...input, tenantId })
    })

    test('Internal server error', async (): Promise<void> => {
      const createSpy = jest
        .spyOn(incomingPaymentService, 'create')
        .mockRejectedValueOnce(new Error('unexpected'))

      const input = {
        walletAddressId: uuid()
      }

      expect.assertions(3)
      try {
        await appContainer.apolloClient
          .query({
            query: gql`
              mutation CreateIncomingPayment(
                $input: CreateIncomingPaymentInput!
              ) {
                createIncomingPayment(input: $input) {
                  payment {
                    id
                    state
                  }
                }
              }
            `,
            variables: { input }
          })
          .then(
            (query): IncomingPaymentResponse =>
              query.data?.createIncomingPayment
          )
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'unexpected',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.InternalServerError
            })
          })
        )
      }
      expect(createSpy).toHaveBeenCalledWith({
        ...input,
        tenantId
      })
    })
  })

  describe('Query.incomingPayment', (): void => {
    let payment: IncomingPaymentModel

    const createPayment = async (options: {
      walletAddressId: string
      metadata?: Record<string, unknown>
    }): Promise<IncomingPaymentModel> => {
      return await createIncomingPayment(deps, {
        ...options,
        incomingAmount: {
          value: BigInt(56),
          assetCode: asset.code,
          assetScale: asset.scale
        },
        tenantId
      })
    }

    describe('metadata', (): void => {
      const metadata = {
        description: 'rent',
        externalRef: '202201'
      }
      beforeEach(async (): Promise<void> => {
        const { id: walletAddressId } = await createWalletAddress(deps, {
          tenantId: Config.operatorTenantId,
          assetId: asset.id
        })
        payment = await createPayment({ walletAddressId, metadata })
      })

      // Query with each payment state
      const states: IncomingPaymentState[] = Object.values(IncomingPaymentState)
      test.each(states)('%s', async (state): Promise<void> => {
        const expiresAt = new Date()
        jest
          .spyOn(incomingPaymentService, 'get')
          .mockImplementation(async () => {
            const updatedPayment = payment
            updatedPayment.state = state
            updatedPayment.expiresAt = expiresAt
            return updatedPayment
          })

        const query = await appContainer.apolloClient
          .query({
            query: gql`
              query IncomingPayment($paymentId: String!) {
                incomingPayment(id: $paymentId) {
                  id
                  walletAddressId
                  state
                  expiresAt
                  liquidity
                  incomingAmount {
                    value
                    assetCode
                    assetScale
                  }
                  receivedAmount {
                    value
                    assetCode
                    assetScale
                  }
                  metadata
                  createdAt
                }
              }
            `,
            variables: {
              paymentId: payment.id
            }
          })
          .then((query): IncomingPayment => query.data?.incomingPayment)

        expect(query).toEqual({
          id: payment.id,
          walletAddressId: payment.walletAddressId,
          state,
          expiresAt: expiresAt.toISOString(),
          liquidity: '0',
          incomingAmount: {
            value: payment.incomingAmount?.value.toString(),
            assetCode: payment.incomingAmount?.assetCode,
            assetScale: payment.incomingAmount?.assetScale,
            __typename: 'Amount'
          },
          receivedAmount: {
            value: payment.receivedAmount.value.toString(),
            assetCode: payment.receivedAmount.assetCode,
            assetScale: payment.receivedAmount.assetScale,
            __typename: 'Amount'
          },
          metadata,
          createdAt: payment.createdAt.toISOString(),
          __typename: 'IncomingPayment'
        })
      })

      test('with added liquidity', async (): Promise<void> => {
        await accountingService.createDeposit({
          id: uuid(),
          account: payment,
          amount: 100n
        })

        const query = await appContainer.apolloClient
          .query({
            query: gql`
              query IncomingPayment($paymentId: String!) {
                incomingPayment(id: $paymentId) {
                  id
                  liquidity
                }
              }
            `,
            variables: {
              paymentId: payment.id
            }
          })
          .then((query): IncomingPayment => query.data?.incomingPayment)

        expect(query).toEqual({
          id: payment.id,
          liquidity: '100',
          __typename: 'IncomingPayment'
        })
      })
    })

    test('not found', async (): Promise<void> => {
      jest
        .spyOn(incomingPaymentService, 'get')
        .mockImplementation(async () => undefined)

      expect.assertions(2)
      try {
        await appContainer.apolloClient.query({
          query: gql`
            query IncomingPayment($paymentId: String!) {
              incomingPayment(id: $paymentId) {
                id
              }
            }
          `,
          variables: { paymentId: uuid() }
        })
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'payment does not exist',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.NotFound
            })
          })
        )
      }
    })
  })

  describe('Mutation.updateIncomingPayment', (): void => {
    let amount: Amount
    let expiresAt: Date

    beforeEach((): void => {
      amount = {
        value: BigInt(56),
        assetCode: asset.code,
        assetScale: asset.scale
      }
      expiresAt = new Date(Date.now() + 30_000)
    })

    test.each`
      metadata
      ${{ description: 'Update metadata', status: 'COMPLETE' }}
      ${{}}
    `(
      'Successfully updates an incoming payment with $metadata',
      async ({ metadata }): Promise<void> => {
        const incomingAmount = amount ? amount : undefined
        const { id: walletAddressId } = await createWalletAddress(deps, {
          tenantId: Config.operatorTenantId,
          assetId: asset.id
        })
        const payment = await createIncomingPayment(deps, {
          walletAddressId,
          metadata,
          expiresAt,
          incomingAmount,
          tenantId
        })
        const input = {
          id: payment.id,
          metadata
        }

        const createSpy = jest
          .spyOn(incomingPaymentService, 'update')
          .mockResolvedValueOnce({
            ...payment,
            metadata: input.metadata
          } as IncomingPaymentModel)

        const query = await appContainer.apolloClient
          .query({
            query: gql`
              mutation UpdateIncomingPayment(
                $input: UpdateIncomingPaymentInput!
              ) {
                updateIncomingPayment(input: $input) {
                  payment {
                    id
                    metadata
                  }
                }
              }
            `,
            variables: { input }
          })
          .then(
            (query): IncomingPaymentResponse =>
              query.data?.updateIncomingPayment
          )

        expect(createSpy).toHaveBeenCalledWith({ ...input, tenantId })
        expect(query).toEqual({
          __typename: 'IncomingPaymentResponse',
          payment: {
            __typename: 'IncomingPayment',
            id: payment.id,
            metadata: metadata || null
          }
        })
      }
    )

    test('Errors when unknown payment id', async (): Promise<void> => {
      const createSpy = jest
        .spyOn(incomingPaymentService, 'update')
        .mockResolvedValueOnce(IncomingPaymentError.UnknownPayment)

      const input = {
        id: uuid(),
        metadata: { description: 'Update metadata', status: 'COMPLETE' }
      }

      expect.assertions(3)
      try {
        await appContainer.apolloClient
          .query({
            query: gql`
              mutation UpdateIncomingPayment(
                $input: UpdateIncomingPaymentInput!
              ) {
                updateIncomingPayment(input: $input) {
                  payment {
                    id
                    metadata
                  }
                }
              }
            `,
            variables: { input }
          })
          .then(
            (query): IncomingPaymentResponse =>
              query.data?.updateIncomingPayment
          )
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: errorToMessage[IncomingPaymentError.UnknownPayment],
            extensions: expect.objectContaining({
              code: errorToCode[IncomingPaymentError.UnknownPayment]
            })
          })
        )
      }
      expect(createSpy).toHaveBeenCalledWith({ ...input, tenantId })
    })

    test('Internal server error', async (): Promise<void> => {
      const createSpy = jest
        .spyOn(incomingPaymentService, 'update')
        .mockRejectedValueOnce(new Error('unexpected'))

      const input = {
        id: uuid(),
        metadata: {}
      }

      expect.assertions(3)
      try {
        await appContainer.apolloClient
          .query({
            query: gql`
              mutation UpdateIncomingPayment(
                $input: UpdateIncomingPaymentInput!
              ) {
                updateIncomingPayment(input: $input) {
                  payment {
                    id
                    metadata
                  }
                }
              }
            `,
            variables: { input }
          })
          .then(
            (query): IncomingPaymentResponse =>
              query.data?.updateIncomingPayment
          )
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'unexpected',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.InternalServerError
            })
          })
        )
      }
      expect(createSpy).toHaveBeenCalledWith({ ...input, tenantId })
    })
  })
})
