import type { NormalizedCacheObject } from '@apollo/client'
import { ApolloClient, gql } from '@apollo/client'
import { GraphqlTypes } from 'mock-account-servicing-lib'

export class AdminClient {
  private apolloClient: ApolloClient<NormalizedCacheObject>

  constructor(apolloClient: ApolloClient<NormalizedCacheObject>) {
    this.apolloClient = apolloClient
  }

  async createReceiver(
    input: GraphqlTypes.CreateReceiverInput
  ): Promise<GraphqlTypes.CreateReceiverResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateReceiver($input: CreateReceiverInput!) {
            createReceiver(input: $input) {
              code
              message
              receiver {
                completed
                createdAt
                expiresAt
                metadata
                id
                incomingAmount {
                  assetCode
                  assetScale
                  value
                }
                walletAddressUrl
                receivedAmount {
                  assetCode
                  assetScale
                  value
                }
                updatedAt
              }
              success
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): GraphqlTypes.CreateReceiverResponse => {
        return data.createReceiver
      })
  }

  async createQuote(
    input: GraphqlTypes.CreateQuoteInput
  ): Promise<GraphqlTypes.QuoteResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateQuote($input: CreateQuoteInput!) {
            createQuote(input: $input) {
              code
              message
              quote {
                createdAt
                expiresAt
                highEstimatedExchangeRate
                id
                lowEstimatedExchangeRate
                maxPacketAmount
                minExchangeRate
                walletAddressId
                receiveAmount {
                  assetCode
                  assetScale
                  value
                }
                receiver
                debitAmount {
                  assetCode
                  assetScale
                  value
                }
              }
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): GraphqlTypes.QuoteResponse => {
        return data.createQuote
      })
  }

  async createOutgoingPayment(
    input: GraphqlTypes.CreateOutgoingPaymentInput
  ): Promise<GraphqlTypes.OutgoingPaymentResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
            createOutgoingPayment(input: $input) {
              code
              message
              payment {
                createdAt
                error
                metadata
                id
                walletAddressId
                receiveAmount {
                  assetCode
                  assetScale
                  value
                }
                receiver
                debitAmount {
                  assetCode
                  assetScale
                  value
                }
                sentAmount {
                  assetCode
                  assetScale
                  value
                }
                state
                stateAttempts
              }
              success
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): GraphqlTypes.OutgoingPaymentResponse => {
        return data.createOutgoingPayment
      })
  }

  async getOutgoingPayment(id: string): Promise<GraphqlTypes.OutgoingPayment> {
    return await this.apolloClient
      .query({
        query: gql`
          query GetOutgoingPayment($id: String!) {
            outgoingPayment(id: $id) {
              createdAt
              error
              metadata
              id
              walletAddressId
              quote {
                id
              }
              receiveAmount {
                assetCode
                assetScale
                value
              }
              receiver
              debitAmount {
                assetCode
                assetScale
                value
              }
              sentAmount {
                assetCode
                assetScale
                value
              }
              state
              stateAttempts
            }
          }
        `,
        variables: { id }
      })
      .then((response): GraphqlTypes.OutgoingPayment => {
        return response.data.outgoingPayment
      })
  }

  async depositOutgoingPaymentLiquidity(
    input: GraphqlTypes.DepositOutgoingPaymentLiquidityInput
  ): Promise<GraphqlTypes.LiquidityMutationResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation DepositOutgoingPaymentLiquidity(
            $input: DepositOutgoingPaymentLiquidityInput!
          ) {
            depositOutgoingPaymentLiquidity(input: $input) {
              code
              success
              message
              error
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): GraphqlTypes.LiquidityMutationResponse => {
        return data.depositOutgoingPaymentLiquidity
      })
  }

  async createWalletAddress(
    input: GraphqlTypes.CreateWalletAddressInput
  ): Promise<GraphqlTypes.CreateWalletAddressMutationResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
            createWalletAddress(input: $input) {
              success
              walletAddress {
                id
                url
                publicName
              }
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): GraphqlTypes.CreateWalletAddressMutationResponse => {
        console.log({ data })
        return data.createWalletAddress
      })
  }
}
