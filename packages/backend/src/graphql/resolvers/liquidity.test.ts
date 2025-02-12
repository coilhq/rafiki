import assert from 'assert'
import { ApolloError, gql } from '@apollo/client'
import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

import { DepositEventType } from './liquidity'
import { createTestApp, TestContainer } from '../../tests/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { initIocContainer } from '../..'
import { Config } from '../../config/app'
import {
  AccountingService,
  LiquidityAccount,
  LiquidityAccountType,
  Withdrawal
} from '../../accounting/service'
import { Asset } from '../../asset/model'
import {
  WalletAddress,
  WalletAddressEventType
} from '../../open_payments/wallet_address/model'
import {
  IncomingPayment,
  IncomingPaymentEventType
} from '../../open_payments/payment/incoming/model'
import {
  OutgoingPayment,
  OutgoingPaymentEvent,
  OutgoingPaymentEventType,
  OutgoingPaymentWithdrawType,
  isOutgoingPaymentEventType
} from '../../open_payments/payment/outgoing/model'
import { Peer } from '../../payment-method/ilp/peer/model'
import { createAsset } from '../../tests/asset'
import { createIncomingPayment } from '../../tests/incomingPayment'
import { createOutgoingPayment } from '../../tests/outgoingPayment'
import { createWalletAddress } from '../../tests/walletAddress'
import { createPeer } from '../../tests/peer'
import { truncateTables } from '../../tests/tableManager'
import { WebhookEvent } from '../../webhook/model'
import {
  LiquidityMutationResponse,
  WalletAddressWithdrawalMutationResponse
} from '../generated/graphql'
import { GraphQLErrorCode } from '../errors'

describe('Liquidity Resolvers', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let accountingService: AccountingService
  let knex: Knex
  const timeoutTwoPhase = 10

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    appContainer = await createTestApp(deps)
    knex = appContainer.knex
    accountingService = await deps.use('accountingService')
  })

  afterAll(async (): Promise<void> => {
    await truncateTables(knex)
    await appContainer.apolloClient.stop()
    await appContainer.shutdown()
  })

  describe('Deposit peer liquidity', (): void => {
    let peer: Peer

    beforeEach(async (): Promise<void> => {
      peer = await createPeer(deps)
    })

    test('Can deposit liquidity to peer', async (): Promise<void> => {
      const id = uuid()
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation DepositPeerLiquidity($input: DepositPeerLiquidityInput!) {
              depositPeerLiquidity(input: $input) {
                success
              }
            }
          `,
          variables: {
            input: {
              id,
              peerId: peer.id,
              amount: '100',
              idempotencyKey: uuid()
            }
          }
        })
        .then((query): LiquidityMutationResponse => {
          if (query.data) {
            return query.data.depositPeerLiquidity
          } else {
            throw new Error('Data was empty')
          }
        })

      expect(response.success).toBe(true)
    })

    test('Returns an error for invalid id', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositPeerLiquidity(
                $input: DepositPeerLiquidityInput!
              ) {
                depositPeerLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: 'not a uuid v4',
                peerId: peer.id,
                amount: '100',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositPeerLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid transfer id',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.BadUserInput
          })
        })
      )
    })

    test('Returns an error for unknown peer', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositPeerLiquidity(
                $input: DepositPeerLiquidityInput!
              ) {
                depositPeerLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                peerId: uuid(),
                amount: '100',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositPeerLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'unknown peer',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.NotFound
          })
        })
      )
    })

    test('Returns an error for existing transfer', async (): Promise<void> => {
      const id = uuid()
      await expect(
        accountingService.createDeposit({
          id,
          account: peer,
          amount: BigInt(100)
        })
      ).resolves.toBeUndefined()

      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositPeerLiquidity(
                $input: DepositPeerLiquidityInput!
              ) {
                depositPeerLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id,
                peerId: peer.id,
                amount: '100',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositPeerLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer already exists',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Duplicate
          })
        })
      )
    })

    test('Returns an error for zero amount', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositPeerLiquidity(
                $input: DepositPeerLiquidityInput!
              ) {
                depositPeerLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: 'not a uuid v4',
                peerId: peer.id,
                amount: '0',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositPeerLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }

      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer amount is zero',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Forbidden
          })
        })
      )
    })
  })

  describe('Deposit asset liquidity', (): void => {
    let asset: Asset

    beforeEach(async (): Promise<void> => {
      asset = await createAsset(deps)
    })

    test('Can deposit liquidity to asset', async (): Promise<void> => {
      const id = uuid()
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation DepositAssetLiquidity(
              $input: DepositAssetLiquidityInput!
            ) {
              depositAssetLiquidity(input: $input) {
                success
              }
            }
          `,
          variables: {
            input: {
              id,
              assetId: asset.id,
              amount: '100',
              idempotencyKey: uuid()
            }
          }
        })
        .then((query): LiquidityMutationResponse => {
          if (query.data) {
            return query.data.depositAssetLiquidity
          } else {
            throw new Error('Data was empty')
          }
        })

      expect(response.success).toBe(true)
    })

    test('Returns an error for invalid id', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositAssetLiquidity(
                $input: DepositAssetLiquidityInput!
              ) {
                depositAssetLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: 'not a uuid',
                assetId: asset.id,
                amount: '100',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositAssetLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid transfer id',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.BadUserInput
          })
        })
      )
    })

    test('Returns an error for unknown asset', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositAssetLiquidity(
                $input: DepositAssetLiquidityInput!
              ) {
                depositAssetLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                assetId: uuid(),
                amount: '100',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositAssetLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Unknown asset',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.NotFound
          })
        })
      )
    })

    test('Returns an error for existing transfer', async (): Promise<void> => {
      const id = uuid()
      await expect(
        accountingService.createDeposit({
          id,
          account: asset,
          amount: BigInt(100)
        })
      ).resolves.toBeUndefined()

      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositAssetLiquidity(
                $input: DepositAssetLiquidityInput!
              ) {
                depositAssetLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id,
                assetId: asset.id,
                amount: '100',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositAssetLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer already exists',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Duplicate
          })
        })
      )
    })

    test('Returns an error for zero amount', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation DepositAssetLiquidity(
                $input: DepositAssetLiquidityInput!
              ) {
                depositAssetLiquidity(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                assetId: asset.id,
                amount: '0',
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.depositAssetLiquidity
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer amount is zero',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Forbidden
          })
        })
      )
    })
  })

  describe('Create peer liquidity withdrawal', (): void => {
    let peer: Peer
    const startingBalance = BigInt(100)

    beforeEach(async (): Promise<void> => {
      peer = await createPeer(deps)
      await expect(
        accountingService.createDeposit({
          id: uuid(),
          account: peer,
          amount: startingBalance
        })
      ).resolves.toBeUndefined()
    })

    test('Can create liquidity withdrawal from peer', async (): Promise<void> => {
      const id = uuid()
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation CreatePeerLiquidityWithdrawal(
              $input: CreatePeerLiquidityWithdrawalInput!
            ) {
              createPeerLiquidityWithdrawal(input: $input) {
                success
              }
            }
          `,
          variables: {
            input: {
              id,
              peerId: peer.id,
              amount: startingBalance.toString(),
              idempotencyKey: uuid(),
              timeoutSeconds: 0
            }
          }
        })
        .then((query): LiquidityMutationResponse => {
          if (query.data) {
            return query.data.createPeerLiquidityWithdrawal
          } else {
            throw new Error('Data was empty')
          }
        })

      expect(response.success).toBe(true)
    })

    test('Returns an error for unknown peer', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreatePeerLiquidityWithdrawal(
                $input: CreatePeerLiquidityWithdrawalInput!
              ) {
                createPeerLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                peerId: uuid(),
                amount: '100',
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.createPeerLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Unknown peer',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.NotFound
          })
        })
      )
    })

    test('Returns an error for invalid id', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreatePeerLiquidityWithdrawal(
                $input: CreatePeerLiquidityWithdrawalInput!
              ) {
                createPeerLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: 'not a uuid',
                peerId: peer.id,
                amount: startingBalance.toString(),
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.createPeerLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid transfer id',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.BadUserInput
          })
        })
      )
    })

    test('Returns an error for existing transfer', async (): Promise<void> => {
      const id = uuid()
      await expect(
        accountingService.createDeposit({
          id,
          account: peer,
          amount: 10n
        })
      ).resolves.toBeUndefined()

      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreatePeerLiquidityWithdrawal(
                $input: CreatePeerLiquidityWithdrawalInput!
              ) {
                createPeerLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id,
                peerId: peer.id,
                amount: startingBalance.toString(),
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.createPeerLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer already exists',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Duplicate
          })
        })
      )
    })

    test.each`
      amount                         | message                            | code
      ${startingBalance + BigInt(1)} | ${'Insufficient transfer balance'} | ${GraphQLErrorCode.Forbidden}
      ${BigInt(0)}                   | ${'Transfer amount is zero'}       | ${GraphQLErrorCode.Forbidden}
    `(
      'Returns error for $code',
      async ({ amount, message, code }): Promise<void> => {
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation CreatePeerLiquidityWithdrawal(
                  $input: CreatePeerLiquidityWithdrawalInput!
                ) {
                  createPeerLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  id: uuid(),
                  peerId: peer.id,
                  amount: amount.toString(),
                  idempotencyKey: uuid(),
                  timeoutSeconds: 0
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.createPeerLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message,
            extensions: expect.objectContaining({
              code
            })
          })
        )
      }
    )
  })

  describe('Create asset liquidity withdrawal', (): void => {
    let asset: Asset
    const startingBalance = BigInt(100)

    beforeEach(async (): Promise<void> => {
      asset = await createAsset(deps)
      await expect(
        accountingService.createDeposit({
          id: uuid(),
          account: asset,
          amount: startingBalance
        })
      ).resolves.toBeUndefined()
    })

    test('Can create liquidity withdrawal from asset', async (): Promise<void> => {
      const id = uuid()
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation CreateAssetLiquidityWithdrawal(
              $input: CreateAssetLiquidityWithdrawalInput!
            ) {
              createAssetLiquidityWithdrawal(input: $input) {
                success
              }
            }
          `,
          variables: {
            input: {
              id,
              assetId: asset.id,
              amount: startingBalance.toString(),
              idempotencyKey: uuid(),
              timeoutSeconds: 0
            }
          }
        })
        .then((query): LiquidityMutationResponse => {
          if (query.data) {
            return query.data.createAssetLiquidityWithdrawal
          } else {
            throw new Error('Data was empty')
          }
        })

      expect(response.success).toBe(true)
    })

    test('Returns an error for unknown asset', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateAssetLiquidityWithdrawal(
                $input: CreateAssetLiquidityWithdrawalInput!
              ) {
                createAssetLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                assetId: uuid(),
                amount: '100',
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.createAssetLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Unknown asset',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.NotFound
          })
        })
      )
    })

    test('Returns an error for invalid id', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateAssetLiquidityWithdrawal(
                $input: CreateAssetLiquidityWithdrawalInput!
              ) {
                createAssetLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id: 'not a uuid',
                assetId: asset.id,
                amount: startingBalance.toString(),
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.createAssetLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid transfer id',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.BadUserInput
          })
        })
      )
    })

    test('Returns an error for existing transfer', async (): Promise<void> => {
      const id = uuid()
      await expect(
        accountingService.createDeposit({
          id,
          account: asset,
          amount: BigInt(10)
        })
      ).resolves.toBeUndefined()

      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateAssetLiquidityWithdrawal(
                $input: CreateAssetLiquidityWithdrawalInput!
              ) {
                createAssetLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                id,
                assetId: asset.id,
                amount: startingBalance.toString(),
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.createAssetLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer already exists',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Duplicate
          })
        })
      )
    })

    test.each`
      amount                         | message                            | code
      ${startingBalance + BigInt(1)} | ${'Insufficient transfer balance'} | ${GraphQLErrorCode.Forbidden}
      ${BigInt(0)}                   | ${'Transfer amount is zero'}       | ${GraphQLErrorCode.Forbidden}
    `(
      'Returns error for $error',
      async ({ amount, code, message }): Promise<void> => {
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation CreateAssetLiquidityWithdrawal(
                  $input: CreateAssetLiquidityWithdrawalInput!
                ) {
                  createAssetLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  id: uuid(),
                  assetId: asset.id,
                  amount: amount.toString(),
                  idempotencyKey: uuid(),
                  timeoutSeconds: 0
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.createAssetLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message,
            extensions: expect.objectContaining({
              code
            })
          })
        )
      }
    )
  })

  describe('Create wallet address withdrawal', (): void => {
    let walletAddress: WalletAddress
    const amount = BigInt(100)

    beforeEach(async (): Promise<void> => {
      walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId,
        createLiquidityAccount: true
      })

      await expect(
        accountingService.createDeposit({
          id: uuid(),
          account: walletAddress,
          amount
        })
      ).resolves.toBeUndefined()
    })

    test('Can create withdrawal from wallet address', async (): Promise<void> => {
      const id = uuid()
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation CreateWalletAddressWithdrawal(
              $input: CreateWalletAddressWithdrawalInput!
            ) {
              createWalletAddressWithdrawal(input: $input) {
                withdrawal {
                  id
                  amount
                  walletAddress {
                    id
                  }
                }
              }
            }
          `,
          variables: {
            input: {
              id,
              walletAddressId: walletAddress.id,
              idempotencyKey: uuid(),
              timeoutSeconds: 0
            }
          }
        })
        .then((query): WalletAddressWithdrawalMutationResponse => {
          if (query.data) {
            return query.data.createWalletAddressWithdrawal
          } else {
            throw new Error('Data was empty')
          }
        })

      expect(response.withdrawal).toMatchObject({
        id,
        amount: amount.toString(),
        walletAddress: {
          id: walletAddress.id
        }
      })
    })

    test('Returns an error for unknown wallet address', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateWalletAddressWithdrawal(
                $input: CreateWalletAddressWithdrawalInput!
              ) {
                createWalletAddressWithdrawal(input: $input) {
                  withdrawal {
                    id
                  }
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                walletAddressId: uuid(),
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): WalletAddressWithdrawalMutationResponse => {
            if (query.data) {
              return query.data.createWalletAddressWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Unknown wallet address',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.NotFound
          })
        })
      )
    })

    test('Returns an error for invalid id', async (): Promise<void> => {
      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateWalletAddressWithdrawal(
                $input: CreateWalletAddressWithdrawalInput!
              ) {
                createWalletAddressWithdrawal(input: $input) {
                  withdrawal {
                    id
                  }
                }
              }
            `,
            variables: {
              input: {
                id: 'not a uuid',
                walletAddressId: walletAddress.id,
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): WalletAddressWithdrawalMutationResponse => {
            if (query.data) {
              return query.data.createWalletAddressWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Invalid transfer id',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.BadUserInput
          })
        })
      )
    })

    test('Returns an error for existing transfer', async (): Promise<void> => {
      const id = uuid()
      await expect(
        accountingService.createDeposit({
          id,
          account: walletAddress,
          amount: BigInt(10)
        })
      ).resolves.toBeUndefined()

      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateWalletAddressWithdrawal(
                $input: CreateWalletAddressWithdrawalInput!
              ) {
                createWalletAddressWithdrawal(input: $input) {
                  withdrawal {
                    id
                  }
                }
              }
            `,
            variables: {
              input: {
                id,
                walletAddressId: walletAddress.id,
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): WalletAddressWithdrawalMutationResponse => {
            if (query.data) {
              return query.data.createWalletAddressWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer already exists',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Duplicate
          })
        })
      )
    })

    test('Returns an error for empty balance', async (): Promise<void> => {
      await expect(
        accountingService.createWithdrawal({
          id: uuid(),
          account: walletAddress,
          amount,
          timeout: 0
        })
      ).resolves.toBeUndefined()

      let error
      try {
        await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation CreateWalletAddressWithdrawal(
                $input: CreateWalletAddressWithdrawalInput!
              ) {
                createWalletAddressWithdrawal(input: $input) {
                  withdrawal {
                    id
                  }
                }
              }
            `,
            variables: {
              input: {
                id: uuid(),
                walletAddressId: walletAddress.id,
                idempotencyKey: uuid(),
                timeoutSeconds: 0
              }
            }
          })
          .then((query): WalletAddressWithdrawalMutationResponse => {
            if (query.data) {
              return query.data.createWalletAddressWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })
      } catch (err) {
        error = err
      }
      expect(error).toBeInstanceOf(ApolloError)
      expect((error as ApolloError).graphQLErrors).toContainEqual(
        expect.objectContaining({
          message: 'Transfer amount is zero',
          extensions: expect.objectContaining({
            code: GraphQLErrorCode.Forbidden
          })
        })
      )
    })
  })

  describe.each(['peer', 'asset'])(
    'Post %s liquidity withdrawal',
    (type): void => {
      let withdrawalId: string

      beforeEach(async (): Promise<void> => {
        const peer = await createPeer(deps)
        const deposit = {
          id: uuid(),
          account: type === 'peer' ? peer : peer.asset,
          amount: BigInt(100)
        }
        await expect(
          accountingService.createDeposit(deposit)
        ).resolves.toBeUndefined()
        withdrawalId = uuid()
        await expect(
          accountingService.createWithdrawal({
            ...deposit,
            id: withdrawalId,
            amount: BigInt(10),
            timeout: timeoutTwoPhase
          })
        ).resolves.toBeUndefined()
      })

      test(`Can post a(n) ${type} liquidity withdrawal`, async (): Promise<void> => {
        const response = await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation PostLiquidityWithdrawal(
                $input: PostLiquidityWithdrawalInput!
              ) {
                postLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                withdrawalId,
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.postLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })

        expect(response.success).toBe(true)
      })

      test("Can't post non-existent withdrawal", async (): Promise<void> => {
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation PostLiquidityWithdrawal(
                  $input: PostLiquidityWithdrawalInput!
                ) {
                  postLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId: uuid(),
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.postLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Unknown transfer',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.NotFound
            })
          })
        )
      })

      test("Can't post invalid withdrawal id", async (): Promise<void> => {
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation PostLiquidityWithdrawal(
                  $input: PostLiquidityWithdrawalInput!
                ) {
                  postLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId: 'not a uuid',
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.postLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Invalid transfer id',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.BadUserInput
            })
          })
        )
      })

      test("Can't post posted withdrawal", async (): Promise<void> => {
        await expect(
          accountingService.postWithdrawal(withdrawalId)
        ).resolves.toBeUndefined()

        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation PostLiquidityWithdrawal(
                  $input: PostLiquidityWithdrawalInput!
                ) {
                  postLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId,
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.postLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Transfer already posted',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.Conflict
            })
          })
        )
      })

      test("Can't post voided withdrawal", async (): Promise<void> => {
        await expect(
          accountingService.voidWithdrawal(withdrawalId)
        ).resolves.toBeUndefined()

        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation PostLiquidityWithdrawal(
                  $input: PostLiquidityWithdrawalInput!
                ) {
                  postLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId,
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.postLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Transfer already voided',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.Conflict
            })
          })
        )
      })
    }
  )

  describe.each(['peer', 'asset'])(
    'Roll back %s liquidity withdrawal',
    (type): void => {
      let withdrawalId: string

      beforeEach(async (): Promise<void> => {
        const peer = await createPeer(deps)
        const deposit = {
          id: uuid(),
          account: type === 'peer' ? peer : peer.asset,
          amount: BigInt(100)
        }
        await expect(
          accountingService.createDeposit(deposit)
        ).resolves.toBeUndefined()
        withdrawalId = uuid()
        await expect(
          accountingService.createWithdrawal({
            ...deposit,
            id: withdrawalId,
            amount: BigInt(10),
            timeout: timeoutTwoPhase
          })
        ).resolves.toBeUndefined()
      })

      test(`Can void a(n) ${type} liquidity withdrawal`, async (): Promise<void> => {
        const response = await appContainer.apolloClient
          .mutate({
            mutation: gql`
              mutation VoidLiquidityWithdrawal(
                $input: VoidLiquidityWithdrawalInput!
              ) {
                voidLiquidityWithdrawal(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                withdrawalId,
                idempotencyKey: uuid()
              }
            }
          })
          .then((query): LiquidityMutationResponse => {
            if (query.data) {
              return query.data.voidLiquidityWithdrawal
            } else {
              throw new Error('Data was empty')
            }
          })

        expect(response.success).toBe(true)
      })

      test("Can't void non-existent withdrawal", async (): Promise<void> => {
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation VoidLiquidityWithdrawal(
                  $input: VoidLiquidityWithdrawalInput!
                ) {
                  voidLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId: uuid(),
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.voidLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Unknown transfer',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.NotFound
            })
          })
        )
      })

      test("Can't void invalid withdrawal id", async (): Promise<void> => {
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation VoidLiquidityWithdrawal(
                  $input: VoidLiquidityWithdrawalInput!
                ) {
                  voidLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId: 'not a uuid',
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.voidLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Invalid transfer id',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.BadUserInput
            })
          })
        )
      })

      test("Can't void posted withdrawal", async (): Promise<void> => {
        await expect(
          accountingService.postWithdrawal(withdrawalId)
        ).resolves.toBeUndefined()
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation VoidLiquidityWithdrawal(
                  $input: VoidLiquidityWithdrawalInput!
                ) {
                  voidLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId,
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.voidLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Transfer already posted',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.Conflict
            })
          })
        )
      })

      test("Can't void voided withdrawal", async (): Promise<void> => {
        await expect(
          accountingService.voidWithdrawal(withdrawalId)
        ).resolves.toBeUndefined()
        let error
        try {
          await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation voidLiquidityWithdrawal(
                  $input: VoidLiquidityWithdrawalInput!
                ) {
                  voidLiquidityWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  withdrawalId,
                  idempotencyKey: uuid()
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.voidLiquidityWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })
        } catch (err) {
          error = err
        }
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'Transfer already voided',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.Conflict
            })
          })
        )
      })
    }
  )

  describe('Event Liquidity', (): void => {
    let tenantId: string
    let walletAddress: WalletAddress
    let incomingPayment: IncomingPayment
    let payment: OutgoingPayment

    beforeEach(async (): Promise<void> => {
      tenantId = Config.operatorTenantId
      walletAddress = await createWalletAddress(deps, {
        tenantId
      })
      const walletAddressId = walletAddress.id
      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId,
        incomingAmount: {
          value: BigInt(56),
          assetCode: walletAddress.asset.code,
          assetScale: walletAddress.asset.scale
        },
        expiresAt: new Date(Date.now() + 60 * 1000)
      })
      payment = await createOutgoingPayment(deps, {
        tenantId,
        walletAddressId,
        method: 'ilp',
        receiver: `${Config.openPaymentsUrl}/incoming-payments/${uuid()}`,
        debitAmount: {
          value: BigInt(456),
          assetCode: walletAddress.asset.code,
          assetScale: walletAddress.asset.scale
        },
        validDestination: false
      })
      await expect(accountingService.getBalance(payment.id)).resolves.toEqual(
        BigInt(0)
      )
    })

    describe('depositEventLiquidity', (): void => {
      describe.each(Object.values(DepositEventType).map((type) => [type]))(
        '%s',
        (type): void => {
          let eventId: string

          beforeEach(async (): Promise<void> => {
            eventId = uuid()
            await OutgoingPaymentEvent.query(knex).insertAndFetch({
              id: eventId,
              outgoingPaymentId: payment.id,
              type,
              data: payment.toData({
                amountSent: BigInt(0),
                balance: BigInt(0)
              })
            })
          })

          test('Can deposit account liquidity', async (): Promise<void> => {
            const depositSpy = jest.spyOn(accountingService, 'createDeposit')
            const response = await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation DepositLiquidity(
                    $input: DepositEventLiquidityInput!
                  ) {
                    depositEventLiquidity(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    eventId,
                    idempotencyKey: uuid()
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.depositEventLiquidity
                } else {
                  throw new Error('Data was empty')
                }
              })

            expect(response.success).toBe(true)
            assert.ok(payment.debitAmount)
            await expect(depositSpy).toHaveBeenCalledWith({
              id: eventId,
              account: expect.any(OutgoingPayment),
              amount: payment.debitAmount.value
            })
            await expect(
              accountingService.getBalance(payment.id)
            ).resolves.toEqual(payment.debitAmount.value)
          })

          test("Can't deposit for non-existent webhook event id", async (): Promise<void> => {
            let error
            try {
              await appContainer.apolloClient
                .mutate({
                  mutation: gql`
                    mutation DepositLiquidity(
                      $input: DepositEventLiquidityInput!
                    ) {
                      depositEventLiquidity(input: $input) {
                        success
                      }
                    }
                  `,
                  variables: {
                    input: {
                      eventId: uuid(),
                      idempotencyKey: uuid()
                    }
                  }
                })
                .then((query): LiquidityMutationResponse => {
                  if (query.data) {
                    return query.data.depositEventLiquidity
                  } else {
                    throw new Error('Data was empty')
                  }
                })
            } catch (err) {
              error = err
            }
            expect(error).toBeInstanceOf(ApolloError)
            expect((error as ApolloError).graphQLErrors).toContainEqual(
              expect.objectContaining({
                message: 'Invalid transfer id',
                extensions: expect.objectContaining({
                  code: GraphQLErrorCode.BadUserInput
                })
              })
            )
          })

          test('Returns an error for existing transfer', async (): Promise<void> => {
            await expect(
              accountingService.createDeposit({
                id: eventId,
                account: incomingPayment,
                amount: BigInt(100)
              })
            ).resolves.toBeUndefined()
            let error
            try {
              await appContainer.apolloClient
                .mutate({
                  mutation: gql`
                    mutation DepositLiquidity(
                      $input: DepositEventLiquidityInput!
                    ) {
                      depositEventLiquidity(input: $input) {
                        success
                      }
                    }
                  `,
                  variables: {
                    input: {
                      eventId,
                      idempotencyKey: uuid()
                    }
                  }
                })
                .then((query): LiquidityMutationResponse => {
                  if (query.data) {
                    return query.data.depositEventLiquidity
                  } else {
                    throw new Error('Data was empty')
                  }
                })
            } catch (err) {
              error = err
            }
            expect(error).toBeInstanceOf(ApolloError)
            expect((error as ApolloError).graphQLErrors).toContainEqual(
              expect.objectContaining({
                message: 'Transfer already exists',
                extensions: expect.objectContaining({
                  code: GraphQLErrorCode.Duplicate
                })
              })
            )
          })
        }
      )
    })

    const WithdrawEventType = {
      ...WalletAddressEventType,
      ...IncomingPaymentEventType,
      ...OutgoingPaymentWithdrawType
    }
    type WithdrawEventType =
      | WalletAddressEventType
      | IncomingPaymentEventType
      | OutgoingPaymentWithdrawType

    interface WithdrawWebhookData {
      id: string
      type: WithdrawEventType
      data: Record<string, unknown>
      withdrawal: {
        accountId: string
        assetId: string
        amount: bigint
      }
      incomingPaymentId?: string
      outgoingPaymentId?: string
      walletAddressId?: string
    }

    const isIncomingPaymentEventType = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
      o: any
    ): o is IncomingPaymentEventType =>
      Object.values(IncomingPaymentEventType).includes(o)

    describe('withdrawEventLiquidity', (): void => {
      describe.each(Object.values(WithdrawEventType).map((type) => [type]))(
        '%s',
        (type): void => {
          let eventId: string
          let withdrawal: Withdrawal

          beforeEach(async (): Promise<void> => {
            eventId = uuid()
            const amount = BigInt(10)
            let liquidityAccount: LiquidityAccount
            let data: Record<string, unknown>
            let resourceId:
              | 'outgoingPaymentId'
              | 'incomingPaymentId'
              | 'walletAddressId'
              | null = null
            if (isOutgoingPaymentEventType(type)) {
              liquidityAccount = payment
              data = payment.toData({
                amountSent: BigInt(0),
                balance: amount
              })
              resourceId = 'outgoingPaymentId'
            } else if (isIncomingPaymentEventType(type)) {
              liquidityAccount = incomingPayment
              data = incomingPayment.toData(amount)
              resourceId = 'incomingPaymentId'
            } else {
              liquidityAccount = walletAddress
              await accountingService.createLiquidityAccount(
                walletAddress,
                LiquidityAccountType.WEB_MONETIZATION
              )
              data = walletAddress.toData(amount)
              if (type !== WalletAddressEventType.WalletAddressNotFound) {
                resourceId = 'walletAddressId'
              }
            }
            const insertPayload: WithdrawWebhookData = {
              id: eventId,
              type,
              data,
              withdrawal: {
                accountId: liquidityAccount.id,
                assetId: liquidityAccount.asset.id,
                amount
              }
            }

            if (resourceId) {
              insertPayload[resourceId] = liquidityAccount.id
            }

            await WebhookEvent.query(knex).insertAndFetch(insertPayload)
            await expect(
              accountingService.createDeposit({
                id: uuid(),
                account: liquidityAccount,
                amount
              })
            ).resolves.toBeUndefined()
            await expect(
              accountingService.getBalance(liquidityAccount.id)
            ).resolves.toEqual(amount)
            withdrawal = {
              id: eventId,
              account: liquidityAccount,
              amount
            }
          })

          test('Can withdraw account liquidity', async (): Promise<void> => {
            const response = await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation WithdrawLiquidity(
                    $input: WithdrawEventLiquidityInput!
                  ) {
                    withdrawEventLiquidity(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    eventId,
                    idempotencyKey: uuid()
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.withdrawEventLiquidity
                } else {
                  throw new Error('Data was empty')
                }
              })

            expect(response.success).toBe(true)
          })

          test('Returns error for non-existent webhook event id', async (): Promise<void> => {
            let error
            try {
              await appContainer.apolloClient
                .mutate({
                  mutation: gql`
                    mutation WithdrawLiquidity(
                      $input: WithdrawEventLiquidityInput!
                    ) {
                      withdrawEventLiquidity(input: $input) {
                        success
                      }
                    }
                  `,
                  variables: {
                    input: {
                      eventId: uuid(),
                      idempotencyKey: uuid()
                    }
                  }
                })
                .then((query): LiquidityMutationResponse => {
                  if (query.data) {
                    return query.data.withdrawEventLiquidity
                  } else {
                    throw new Error('Data was empty')
                  }
                })
            } catch (err) {
              error = err
            }
            expect(error).toBeInstanceOf(ApolloError)
            expect((error as ApolloError).graphQLErrors).toContainEqual(
              expect.objectContaining({
                message: 'Invalid transfer id',
                extensions: expect.objectContaining({
                  code: GraphQLErrorCode.BadUserInput
                })
              })
            )
          })

          test('Returns error for already completed withdrawal', async (): Promise<void> => {
            await expect(
              accountingService.createWithdrawal(withdrawal)
            ).resolves.toBeUndefined()

            let error
            try {
              await appContainer.apolloClient
                .mutate({
                  mutation: gql`
                    mutation WithdrawLiquidity(
                      $input: WithdrawEventLiquidityInput!
                    ) {
                      withdrawEventLiquidity(input: $input) {
                        success
                      }
                    }
                  `,
                  variables: {
                    input: {
                      eventId,
                      idempotencyKey: uuid()
                    }
                  }
                })
                .then((query): LiquidityMutationResponse => {
                  if (query.data) {
                    return query.data.withdrawEventLiquidity
                  } else {
                    throw new Error('Data was empty')
                  }
                })
            } catch (err) {
              error = err
            }
            expect(error).toBeInstanceOf(ApolloError)
            expect((error as ApolloError).graphQLErrors).toContainEqual(
              expect.objectContaining({
                message: 'Transfer already exists',
                extensions: expect.objectContaining({
                  code: GraphQLErrorCode.Duplicate
                })
              })
            )
          })
        }
      )
    })
  })

  describe('Payment Liquidity', (): void => {
    let walletAddress: WalletAddress
    let incomingPayment: IncomingPayment
    let outgoingPayment: OutgoingPayment

    beforeEach(async (): Promise<void> => {
      walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId
      })
      const walletAddressId = walletAddress.id
      incomingPayment = await createIncomingPayment(deps, {
        walletAddressId,
        incomingAmount: {
          value: BigInt(56),
          assetCode: walletAddress.asset.code,
          assetScale: walletAddress.asset.scale
        },
        expiresAt: new Date(Date.now() + 60 * 1000)
      })
      outgoingPayment = await createOutgoingPayment(deps, {
        tenantId: Config.operatorTenantId,
        walletAddressId,
        method: 'ilp',
        receiver: `${
          Config.openPaymentsUrl
        }/${uuid()}/incoming-payments/${uuid()}`,
        debitAmount: {
          value: BigInt(456),
          assetCode: walletAddress.asset.code,
          assetScale: walletAddress.asset.scale
        },
        validDestination: false
      })
      await expect(
        accountingService.getBalance(outgoingPayment.id)
      ).resolves.toEqual(BigInt(0))
    })

    describe('createIncomingPaymentWithdrawal', (): void => {
      const amount = BigInt(10)

      beforeEach(async (): Promise<void> => {
        await expect(
          accountingService.createDeposit({
            id: uuid(),
            account: incomingPayment,
            amount
          })
        ).resolves.toBeUndefined()
        await expect(
          accountingService.getBalance(incomingPayment.id)
        ).resolves.toEqual(amount)
      })

      describe('Can withdraw liquidity', () => {
        test.each([
          IncomingPaymentEventType.IncomingPaymentCompleted,
          IncomingPaymentEventType.IncomingPaymentExpired
        ])('for incoming payment event %s', async (eventType) => {
          const balance = await accountingService.getBalance(incomingPayment.id)
          assert.ok(balance === amount)

          await WebhookEvent.query(knex).insert({
            id: uuid(),
            incomingPaymentId: incomingPayment.id,
            type: eventType,
            data: {},
            withdrawal: {
              accountId: incomingPayment.id,
              assetId: incomingPayment.asset.id,
              amount
            }
          })

          const response = await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation CreateIncomingPaymentWithdrawal(
                  $input: CreateIncomingPaymentWithdrawalInput!
                ) {
                  createIncomingPaymentWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  incomingPaymentId: incomingPayment.id,
                  idempotencyKey: uuid(),
                  timeoutSeconds: 0
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.createIncomingPaymentWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })

          expect(response.success).toBe(true)
          expect(
            accountingService.getBalance(incomingPayment.id)
          ).resolves.toEqual(balance - amount)
        })
      })

      describe('Cannot withdraw liquidity', () => {
        test('Returns error for non-existent incoming payment id', async (): Promise<void> => {
          await WebhookEvent.query(knex).insert({
            id: uuid(),
            incomingPaymentId: incomingPayment.id,
            type: IncomingPaymentEventType.IncomingPaymentCompleted,
            data: {},
            withdrawal: {
              accountId: incomingPayment.id,
              assetId: incomingPayment.asset.id,
              amount
            }
          })
          let error
          try {
            await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation CreateIncomingPaymentWithdrawal(
                    $input: CreateIncomingPaymentWithdrawalInput!
                  ) {
                    createIncomingPaymentWithdrawal(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    incomingPaymentId: uuid(),
                    idempotencyKey: uuid(),
                    timeoutSeconds: 0
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.createIncomingPaymentWithdrawal
                } else {
                  throw new Error('Data was empty')
                }
              })
          } catch (err) {
            error = err
          }
          expect(error).toBeInstanceOf(ApolloError)
          expect((error as ApolloError).graphQLErrors).toContainEqual(
            expect.objectContaining({
              message: 'Invalid transfer id',
              extensions: expect.objectContaining({
                code: GraphQLErrorCode.BadUserInput
              })
            })
          )
        })

        test('Returns error when related webhook not found', async (): Promise<void> => {
          let error
          try {
            await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation CreateIncomingPaymentWithdrawal(
                    $input: CreateIncomingPaymentWithdrawalInput!
                  ) {
                    createIncomingPaymentWithdrawal(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    incomingPaymentId: incomingPayment.id,
                    idempotencyKey: uuid(),
                    timeoutSeconds: 0
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.createIncomingPaymentWithdrawal
                } else {
                  throw new Error('Data was empty')
                }
              })
          } catch (err) {
            error = err
          }
          expect(error).toBeInstanceOf(ApolloError)
          expect((error as ApolloError).graphQLErrors).toContainEqual(
            expect.objectContaining({
              message: 'Invalid transfer id',
              extensions: expect.objectContaining({
                code: GraphQLErrorCode.BadUserInput
              })
            })
          )
        })

        test('Returns error for already completed withdrawal', async (): Promise<void> => {
          const eventId = uuid()
          await WebhookEvent.query(knex).insert({
            id: eventId,
            incomingPaymentId: incomingPayment.id,
            type: IncomingPaymentEventType.IncomingPaymentCompleted,
            data: {},
            withdrawal: {
              accountId: incomingPayment.id,
              assetId: incomingPayment.asset.id,
              amount
            }
          })
          await expect(
            accountingService.createWithdrawal({
              id: eventId,
              account: incomingPayment,
              amount: amount
            })
          ).resolves.toBeUndefined()

          let error
          try {
            await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation CreateIncomingPaymentWithdrawal(
                    $input: CreateIncomingPaymentWithdrawalInput!
                  ) {
                    createIncomingPaymentWithdrawal(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    incomingPaymentId: incomingPayment.id,
                    idempotencyKey: uuid(),
                    timeoutSeconds: 0
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.createIncomingPaymentWithdrawal
                } else {
                  throw new Error('Data was empty')
                }
              })
          } catch (err) {
            error = err
          }
          expect(error).toBeInstanceOf(ApolloError)
          expect((error as ApolloError).graphQLErrors).toContainEqual(
            expect.objectContaining({
              message: 'Transfer already exists',
              extensions: expect.objectContaining({
                code: GraphQLErrorCode.Duplicate
              })
            })
          )
        })
      })
    })

    describe('createOutgoingPaymentWithdrawal', (): void => {
      const amount = BigInt(10)

      beforeEach(async (): Promise<void> => {
        await expect(
          accountingService.createDeposit({
            id: uuid(),
            account: outgoingPayment,
            amount
          })
        ).resolves.toBeUndefined()
        await expect(
          accountingService.getBalance(outgoingPayment.id)
        ).resolves.toEqual(amount)
      })

      describe('Can withdraw liquidity', () => {
        test.each([
          OutgoingPaymentEventType.PaymentCompleted,
          OutgoingPaymentEventType.PaymentFailed
        ])('for outgoing payment event %s', async (eventType) => {
          const balance = await accountingService.getBalance(outgoingPayment.id)
          assert.ok(balance === amount)

          await WebhookEvent.query(knex).insert({
            id: uuid(),
            outgoingPaymentId: outgoingPayment.id,
            type: eventType,
            data: {},
            withdrawal: {
              accountId: outgoingPayment.id,
              assetId: outgoingPayment.asset.id,
              amount
            }
          })

          const response = await appContainer.apolloClient
            .mutate({
              mutation: gql`
                mutation CreateOutgoingPaymentWithdrawal(
                  $input: CreateOutgoingPaymentWithdrawalInput!
                ) {
                  createOutgoingPaymentWithdrawal(input: $input) {
                    success
                  }
                }
              `,
              variables: {
                input: {
                  outgoingPaymentId: outgoingPayment.id,
                  idempotencyKey: uuid(),
                  timeoutSeconds: 0
                }
              }
            })
            .then((query): LiquidityMutationResponse => {
              if (query.data) {
                return query.data.createOutgoingPaymentWithdrawal
              } else {
                throw new Error('Data was empty')
              }
            })

          expect(response.success).toBe(true)
          expect(
            accountingService.getBalance(outgoingPayment.id)
          ).resolves.toEqual(balance - amount)
        })
      })

      describe('Cannot withdraw liquidity', () => {
        test('Returns error for non-existent outgoing payment id', async (): Promise<void> => {
          let error
          try {
            await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation CreateOutgoingPaymentWithdrawal(
                    $input: CreateOutgoingPaymentWithdrawalInput!
                  ) {
                    createOutgoingPaymentWithdrawal(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    outgoingPaymentId: uuid(),
                    idempotencyKey: uuid(),
                    timeoutSeconds: 0
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.createOutgoingPaymentWithdrawal
                } else {
                  throw new Error('Data was empty')
                }
              })
          } catch (err) {
            error = err
          }
          expect(error).toBeInstanceOf(ApolloError)
          expect((error as ApolloError).graphQLErrors).toContainEqual(
            expect.objectContaining({
              message: 'Invalid transfer id',
              extensions: expect.objectContaining({
                code: GraphQLErrorCode.BadUserInput
              })
            })
          )
        })

        test('Returns error when related webhook not found', async (): Promise<void> => {
          await expect(
            accountingService.createWithdrawal({
              id: outgoingPayment.id,
              account: outgoingPayment,
              amount: amount
            })
          ).resolves.toBeUndefined()
          let error
          try {
            await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation CreateIncomingPaymentWithdrawal(
                    $input: CreateOutgoingPaymentWithdrawalInput!
                  ) {
                    createOutgoingPaymentWithdrawal(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    outgoingPaymentId: outgoingPayment.id,
                    idempotencyKey: uuid(),
                    timeoutSeconds: 0
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.createOutgoingPaymentWithdrawal
                } else {
                  throw new Error('Data was empty')
                }
              })
          } catch (err) {
            error = err
          }
          expect(error).toBeInstanceOf(ApolloError)
          expect((error as ApolloError).graphQLErrors).toContainEqual(
            expect.objectContaining({
              message: 'Invalid transfer id',
              extensions: expect.objectContaining({
                code: GraphQLErrorCode.BadUserInput
              })
            })
          )
        })

        test('Returns error for already completed withdrawal', async (): Promise<void> => {
          await WebhookEvent.query(knex).insert({
            id: uuid(),
            outgoingPaymentId: outgoingPayment.id,
            type: OutgoingPaymentEventType.PaymentCompleted,
            data: {},
            withdrawal: {
              accountId: outgoingPayment.id,
              assetId: outgoingPayment.asset.id,
              amount
            }
          })
          await expect(
            accountingService.createWithdrawal({
              id: outgoingPayment.id,
              account: outgoingPayment,
              amount: amount
            })
          ).resolves.toBeUndefined()

          let error
          try {
            await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation CreateOutgoingPaymentWithdrawal(
                    $input: CreateOutgoingPaymentWithdrawalInput!
                  ) {
                    createOutgoingPaymentWithdrawal(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    outgoingPaymentId: outgoingPayment.id,
                    idempotencyKey: uuid(),
                    timeoutSeconds: 0
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.createOutgoingPaymentWithdrawal
                } else {
                  throw new Error('Data was empty')
                }
              })
          } catch (err) {
            error = err
          }
          expect(error).toBeInstanceOf(ApolloError)
          expect((error as ApolloError).graphQLErrors).toContainEqual(
            expect.objectContaining({
              message: 'Insufficient transfer balance',
              extensions: expect.objectContaining({
                code: GraphQLErrorCode.Forbidden
              })
            })
          )
        })
      })
    })

    describe('depositOutgoingPaymentLiquidity', (): void => {
      describe.each(Object.values(DepositEventType).map((type) => [type]))(
        '%s',
        (type): void => {
          let eventId: string

          beforeEach(async (): Promise<void> => {
            eventId = uuid()
            await OutgoingPaymentEvent.query(knex).insertAndFetch({
              id: eventId,
              outgoingPaymentId: outgoingPayment.id,
              type,
              data: outgoingPayment.toData({
                amountSent: BigInt(0),
                balance: BigInt(0)
              })
            })
          })

          test('Can deposit account liquidity', async (): Promise<void> => {
            const depositSpy = jest.spyOn(accountingService, 'createDeposit')
            const response = await appContainer.apolloClient
              .mutate({
                mutation: gql`
                  mutation DepositLiquidity(
                    $input: DepositOutgoingPaymentLiquidityInput!
                  ) {
                    depositOutgoingPaymentLiquidity(input: $input) {
                      success
                    }
                  }
                `,
                variables: {
                  input: {
                    outgoingPaymentId: outgoingPayment.id,
                    idempotencyKey: uuid()
                  }
                }
              })
              .then((query): LiquidityMutationResponse => {
                if (query.data) {
                  return query.data.depositOutgoingPaymentLiquidity
                } else {
                  throw new Error('Data was empty')
                }
              })

            expect(response.success).toBe(true)
            assert.ok(outgoingPayment.debitAmount)
            await expect(depositSpy).toHaveBeenCalledWith({
              id: eventId,
              account: expect.any(OutgoingPayment),
              amount: outgoingPayment.debitAmount.value
            })
            await expect(
              accountingService.getBalance(outgoingPayment.id)
            ).resolves.toEqual(outgoingPayment.debitAmount.value)
          })

          test("Can't deposit for non-existent outgoing payment id", async (): Promise<void> => {
            let error
            try {
              await appContainer.apolloClient
                .mutate({
                  mutation: gql`
                    mutation DepositLiquidity(
                      $input: DepositOutgoingPaymentLiquidityInput!
                    ) {
                      depositOutgoingPaymentLiquidity(input: $input) {
                        success
                      }
                    }
                  `,
                  variables: {
                    input: {
                      outgoingPaymentId: uuid(),
                      idempotencyKey: uuid()
                    }
                  }
                })
                .then((query): LiquidityMutationResponse => {
                  if (query.data) {
                    return query.data.depositOutgoingPaymentLiquidity
                  } else {
                    throw new Error('Data was empty')
                  }
                })
            } catch (err) {
              error = err
            }
            expect(error).toBeInstanceOf(ApolloError)
            expect((error as ApolloError).graphQLErrors).toContainEqual(
              expect.objectContaining({
                message: 'Invalid transfer id',
                extensions: expect.objectContaining({
                  code: GraphQLErrorCode.BadUserInput
                })
              })
            )
          })

          test('Returns an error for existing transfer', async (): Promise<void> => {
            await expect(
              accountingService.createDeposit({
                id: eventId,
                account: incomingPayment,
                amount: BigInt(100)
              })
            ).resolves.toBeUndefined()
            let error
            try {
              await appContainer.apolloClient
                .mutate({
                  mutation: gql`
                    mutation DepositLiquidity(
                      $input: DepositOutgoingPaymentLiquidityInput!
                    ) {
                      depositOutgoingPaymentLiquidity(input: $input) {
                        success
                      }
                    }
                  `,
                  variables: {
                    input: {
                      outgoingPaymentId: outgoingPayment.id,
                      idempotencyKey: uuid()
                    }
                  }
                })
                .then((query): LiquidityMutationResponse => {
                  if (query.data) {
                    return query.data.depositOutgoingPaymentLiquidity
                  } else {
                    throw new Error('Data was empty')
                  }
                })
            } catch (err) {
              error = err
            }
            expect(error).toBeInstanceOf(ApolloError)
            expect((error as ApolloError).graphQLErrors).toContainEqual(
              expect.objectContaining({
                message: 'Transfer already exists',
                extensions: expect.objectContaining({
                  code: GraphQLErrorCode.Duplicate
                })
              })
            )
          })
        }
      )
    })
  })
})
