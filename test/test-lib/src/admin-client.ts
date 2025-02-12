import type { NormalizedCacheObject } from '@apollo/client'
import { ApolloClient, gql } from '@apollo/client'
import {
  CreateOutgoingPaymentInput,
  CreateQuoteInput,
  CreateReceiverInput,
  CreateReceiverResponse,
  CreateWalletAddressInput,
  CreateWalletAddressMutationResponse,
  DepositOutgoingPaymentLiquidityInput,
  IncomingPayment,
  LiquidityMutationResponse,
  OutgoingPayment,
  OutgoingPaymentResponse,
  QuoteResponse
} from './generated/graphql'

export class AdminClient {
  private apolloClient: ApolloClient<NormalizedCacheObject>

  constructor(apolloClient: ApolloClient<NormalizedCacheObject>) {
    this.apolloClient = apolloClient
  }

  async createReceiver(
    input: CreateReceiverInput
  ): Promise<CreateReceiverResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateReceiver($input: CreateReceiverInput!) {
            createReceiver(input: $input) {
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
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): CreateReceiverResponse => {
        return data.createReceiver
      })
  }

  async createQuote(input: CreateQuoteInput): Promise<QuoteResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateQuote($input: CreateQuoteInput!) {
            createQuote(input: $input) {
              quote {
                createdAt
                expiresAt
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
              }
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): QuoteResponse => {
        return data.createQuote
      })
  }

  async createOutgoingPayment(
    input: CreateOutgoingPaymentInput
  ): Promise<OutgoingPaymentResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateOutgoingPayment($input: CreateOutgoingPaymentInput!) {
            createOutgoingPayment(input: $input) {
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
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): OutgoingPaymentResponse => {
        return data.createOutgoingPayment
      })
  }

  async getIncomingPayment(id: string): Promise<IncomingPayment> {
    return await this.apolloClient
      .query({
        query: gql`
          query GetIncomingPayment($id: String!) {
            incomingPayment(id: $id) {
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
        `,
        variables: { id }
      })
      .then((response): IncomingPayment => {
        return response.data.incomingPayment
      })
  }

  async getOutgoingPayment(id: string): Promise<OutgoingPayment> {
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
      .then((response): OutgoingPayment => {
        return response.data.outgoingPayment
      })
  }

  async depositOutgoingPaymentLiquidity(
    input: DepositOutgoingPaymentLiquidityInput
  ): Promise<LiquidityMutationResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation DepositOutgoingPaymentLiquidity(
            $input: DepositOutgoingPaymentLiquidityInput!
          ) {
            depositOutgoingPaymentLiquidity(input: $input) {
              success
            }
          }
        `,
        variables: { input }
      })
      .then(({ data }): LiquidityMutationResponse => {
        return data.depositOutgoingPaymentLiquidity
      })
  }

  async createWalletAddress(
    input: CreateWalletAddressInput
  ): Promise<CreateWalletAddressMutationResponse> {
    return await this.apolloClient
      .mutate({
        mutation: gql`
          mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
            createWalletAddress(input: $input) {
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
      .then(({ data }): CreateWalletAddressMutationResponse => {
        return data.createWalletAddress
      })
  }
}
