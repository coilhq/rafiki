import { gql, ApolloError } from '@apollo/client'
import { v4 as uuid } from 'uuid'

import { getPageTests } from './page.test'
import { createTestApp, TestContainer } from '../../tests/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { initIocContainer } from '../..'
import { Config } from '../../config/app'
import { Asset } from '../../asset/model'
import { createAsset } from '../../tests/asset'
import { createWalletAddress } from '../../tests/walletAddress'
import { createQuote } from '../../tests/quote'
import { truncateTables } from '../../tests/tableManager'
import {
  QuoteError,
  errorToMessage,
  errorToCode
} from '../../open_payments/quote/errors'
import { QuoteService } from '../../open_payments/quote/service'
import { Quote as QuoteModel } from '../../open_payments/quote/model'
import { Amount } from '../../open_payments/amount'
import { CreateQuoteInput, Quote, QuoteResponse } from '../generated/graphql'
import { GraphQLErrorCode } from '../errors'

describe('Quote Resolvers', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let quoteService: QuoteService
  let asset: Asset
  let tenantId: string

  const receivingWalletAddress = 'http://wallet2.example/bob'
  const receiver = `${receivingWalletAddress}/incoming-payments/${uuid()}`

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    appContainer = await createTestApp(deps)
    quoteService = await deps.use('quoteService')
  })

  beforeEach(async (): Promise<void> => {
    tenantId = Config.operatorTenantId
    asset = await createAsset(deps)
  })

  afterEach(async (): Promise<void> => {
    jest.restoreAllMocks()
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.apolloClient.stop()
    await appContainer.shutdown()
  })

  const createWalletAddressQuote = async (
    walletAddressId: string
  ): Promise<QuoteModel> => {
    return await createQuote(deps, {
      tenantId,
      walletAddressId,
      receiver,
      debitAmount: {
        value: BigInt(56),
        assetCode: asset.code,
        assetScale: asset.scale
      },
      method: 'ilp',
      validDestination: false
    })
  }

  describe('Query.quote', (): void => {
    test('success', async (): Promise<void> => {
      const { id: walletAddressId } = await createWalletAddress(deps, {
        tenantId,
        assetId: asset.id
      })
      const quote = await createWalletAddressQuote(walletAddressId)

      const query = await appContainer.apolloClient
        .query({
          query: gql`
            query Quote($quoteId: String!) {
              quote(id: $quoteId) {
                id
                walletAddressId
                receiver
                debitAmount {
                  value
                  assetCode
                  assetScale
                }
                receiveAmount {
                  value
                  assetCode
                  assetScale
                }
                createdAt
                expiresAt
              }
            }
          `,
          variables: {
            quoteId: quote.id
          }
        })
        .then((query): Quote => query.data?.quote)

      expect(query).toEqual({
        id: quote.id,
        walletAddressId,
        receiver: quote.receiver,
        debitAmount: {
          value: quote.debitAmount.value.toString(),
          assetCode: quote.debitAmount.assetCode,
          assetScale: quote.debitAmount.assetScale,
          __typename: 'Amount'
        },
        receiveAmount: {
          value: quote.receiveAmount.value.toString(),
          assetCode: quote.receiveAmount.assetCode,
          assetScale: quote.receiveAmount.assetScale,
          __typename: 'Amount'
        },
        createdAt: quote.createdAt.toISOString(),
        expiresAt: quote.expiresAt.toISOString(),
        __typename: 'Quote'
      })
    })

    test('Not found', async (): Promise<void> => {
      jest.spyOn(quoteService, 'get').mockImplementation(async () => undefined)

      expect.assertions(2)
      try {
        await appContainer.apolloClient.query({
          query: gql`
            query Quote($quoteId: String!) {
              quote(id: $quoteId) {
                id
              }
            }
          `,
          variables: {
            quoteId: uuid()
          }
        })
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: 'quote does not exist',
            extensions: expect.objectContaining({
              code: GraphQLErrorCode.NotFound
            })
          })
        )
      }
    })
  })

  describe('Mutation.createQuote', (): void => {
    const receiveAsset = {
      code: 'XRP',
      scale: 9
    }
    const receiveAmount: Amount = {
      value: BigInt(56),
      assetCode: receiveAsset.code,
      assetScale: receiveAsset.scale
    }
    let debitAmount: Amount
    let input: CreateQuoteInput

    beforeEach((): void => {
      debitAmount = {
        value: BigInt(123),
        assetCode: asset.code,
        assetScale: asset.scale
      }
      input = {
        walletAddressId: uuid(),
        receiver,
        debitAmount
      }
    })

    test.each`
      withAmount | receiveAmount    | type
      ${true}    | ${undefined}     | ${'fixed send to incoming payment'}
      ${false}   | ${receiveAmount} | ${'fixed receive to incoming payment'}
      ${false}   | ${undefined}     | ${'incoming payment'}
    `('$type', async ({ withAmount, receiveAmount }): Promise<void> => {
      const amount = withAmount ? debitAmount : undefined
      const { id: walletAddressId } = await createWalletAddress(deps, {
        tenantId,
        assetId: asset.id
      })
      const input = {
        walletAddressId,
        debitAmount: amount,
        receiveAmount,
        receiver
      }

      let quote: QuoteModel | undefined
      const createSpy = jest
        .spyOn(quoteService, 'create')
        .mockImplementationOnce(async (opts) => {
          quote = await createQuote(deps, {
            ...opts,
            tenantId,
            validDestination: false
          })
          return quote
        })

      const query = await appContainer.apolloClient
        .query({
          query: gql`
            mutation CreateQuote($input: CreateQuoteInput!) {
              createQuote(input: $input) {
                quote {
                  id
                }
              }
            }
          `,
          variables: { input }
        })
        .then((query): QuoteResponse => query.data?.createQuote)

      expect(createSpy).toHaveBeenCalledWith({
        ...input,
        tenantId,
        method: 'ilp'
      })
      expect(query.quote?.id).toBe(quote?.id)
    })

    test('unknown walletAddress', async (): Promise<void> => {
      expect.assertions(2)
      try {
        await appContainer.apolloClient
          .query({
            query: gql`
              mutation CreateQuote($input: CreateQuoteInput!) {
                createQuote(input: $input) {
                  quote {
                    id
                  }
                }
              }
            `,
            variables: { input }
          })
          .then((query): QuoteResponse => query.data?.createQuote)
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError)
        expect((error as ApolloError).graphQLErrors).toContainEqual(
          expect.objectContaining({
            message: errorToMessage[QuoteError.UnknownWalletAddress],
            extensions: expect.objectContaining({
              code: errorToCode[QuoteError.UnknownWalletAddress]
            })
          })
        )
      }
    })

    test('unknown error', async (): Promise<void> => {
      const createSpy = jest
        .spyOn(quoteService, 'create')
        .mockRejectedValueOnce(new Error('unexpected'))

      expect.assertions(3)
      try {
        await appContainer.apolloClient
          .query({
            query: gql`
              mutation CreateQuote($input: CreateQuoteInput!) {
                createQuote(input: $input) {
                  quote {
                    id
                  }
                }
              }
            `,
            variables: { input }
          })
          .then((query): QuoteResponse => query.data?.createQuote)
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
        tenantId,
        method: 'ilp'
      })
    })
  })

  describe('Wallet address quotes', (): void => {
    let walletAddressId: string

    beforeEach(async (): Promise<void> => {
      walletAddressId = (
        await createWalletAddress(deps, {
          tenantId,
          assetId: asset.id
        })
      ).id
    })

    getPageTests({
      getClient: () => appContainer.apolloClient,
      createModel: () => createWalletAddressQuote(walletAddressId),
      pagedQuery: 'quotes',
      parent: {
        query: 'walletAddress',
        getId: () => walletAddressId
      }
    })
  })
})
