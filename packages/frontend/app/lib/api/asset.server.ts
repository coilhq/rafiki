import { gql } from '@apollo/client'
import type {
  DepositAssetLiquidityInput,
  DepositAssetLiquidityMutation,
  DepositAssetLiquidityMutationVariables,
  CreateAssetInput,
  CreateAssetLiquidityWithdrawalInput,
  CreateAssetMutation,
  CreateAssetMutationVariables,
  GetAssetQuery,
  GetAssetQueryVariables,
  GetAssetWithFeesQuery,
  GetAssetWithFeesQueryVariables,
  ListAssetsQuery,
  ListAssetsQueryVariables,
  QueryAssetArgs,
  QueryAssetsArgs,
  SetFeeInput,
  SetFeeMutation,
  SetFeeMutationVariables,
  UpdateAssetInput,
  UpdateAssetMutation,
  UpdateAssetMutationVariables,
  WithdrawAssetLiquidity,
  WithdrawAssetLiquidityVariables
} from '~/generated/graphql'
import { apolloClient } from '../apollo.server'

export const getAssetInfo = async (args: QueryAssetArgs) => {
  const response = await apolloClient.query<
    GetAssetQuery,
    GetAssetQueryVariables
  >({
    query: gql`
      query GetAssetQuery($id: String!) {
        asset(id: $id) {
          id
          code
          scale
          withdrawalThreshold
          liquidity
          sendingFee {
            basisPoints
            fixed
            createdAt
          }
          createdAt
        }
      }
    `,
    variables: args
  })
  return response.data.asset
}

export const getAssetWithFees = async (args: QueryAssetArgs) => {
  const response = await apolloClient.query<
    GetAssetWithFeesQuery,
    GetAssetWithFeesQueryVariables
  >({
    query: gql`
      query GetAssetWithFeesQuery(
        $id: String!
        $after: String
        $before: String
        $first: Int
        $last: Int
      ) {
        asset(id: $id) {
          fees(after: $after, before: $before, first: $first, last: $last) {
            edges {
              cursor
              node {
                assetId
                basisPoints
                createdAt
                fixed
                id
                type
              }
            }
            pageInfo {
              endCursor
              hasNextPage
              hasPreviousPage
              startCursor
            }
          }
        }
      }
    `,
    variables: args
  })
  return response.data.asset
}

export const listAssets = async (args: QueryAssetsArgs) => {
  const response = await apolloClient.query<
    ListAssetsQuery,
    ListAssetsQueryVariables
  >({
    query: gql`
      query ListAssetsQuery(
        $after: String
        $before: String
        $first: Int
        $last: Int
      ) {
        assets(after: $after, before: $before, first: $first, last: $last) {
          edges {
            node {
              code
              id
              scale
              withdrawalThreshold
              createdAt
            }
          }
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `,
    variables: args
  })

  return response.data.assets
}

export const createAsset = async (args: CreateAssetInput) => {
  const response = await apolloClient.mutate<
    CreateAssetMutation,
    CreateAssetMutationVariables
  >({
    mutation: gql`
      mutation CreateAssetMutation($input: CreateAssetInput!) {
        createAsset(input: $input) {
          code
          success
          message
          asset {
            id
          }
        }
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.createAsset
}

export const updateAsset = async (args: UpdateAssetInput) => {
  const response = await apolloClient.mutate<
    UpdateAssetMutation,
    UpdateAssetMutationVariables
  >({
    mutation: gql`
      mutation UpdateAssetMutation($input: UpdateAssetInput!) {
        updateAsset(input: $input) {
          code
          success
          message
        }
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.updateAsset
}

export const setFee = async (args: SetFeeInput) => {
  const response = await apolloClient.mutate<
    SetFeeMutation,
    SetFeeMutationVariables
  >({
    mutation: gql`
      mutation SetFeeMutation($input: SetFeeInput!) {
        setFee(input: $input) {
          code
          fee {
            assetId
            basisPoints
            createdAt
            fixed
            id
            type
          }
          message
          success
        }
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.setFee
}

export const depositAssetLiquidity = async (
  args: DepositAssetLiquidityInput
) => {
  const response = await apolloClient.mutate<
    DepositAssetLiquidityMutation,
    DepositAssetLiquidityMutationVariables
  >({
    mutation: gql`
      mutation DepositAssetLiquidityMutation(
        $input: DepositAssetLiquidityInput!
      ) {
        depositAssetLiquidity(input: $input) {
          code
          success
          message
          error
        }
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.depositAssetLiquidity
}

export const withdrawAssetLiquidity = async (
  args: CreateAssetLiquidityWithdrawalInput
) => {
  const response = await apolloClient.mutate<
    WithdrawAssetLiquidity,
    WithdrawAssetLiquidityVariables
  >({
    mutation: gql`
      mutation WithdrawAssetLiquidity(
        $input: CreateAssetLiquidityWithdrawalInput!
      ) {
        createAssetLiquidityWithdrawal(input: $input) {
          code
          success
          message
          error
        }
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.createAssetLiquidityWithdrawal
}

export const loadAssets = async () => {
  let assets: ListAssetsQuery['assets']['edges'] = []
  let hasNextPage = true
  let after: string | undefined

  while (hasNextPage) {
    const response = await listAssets({ first: 100, after })

    if (response.edges) {
      assets = [...assets, ...response.edges]
    }

    hasNextPage = response.pageInfo.hasNextPage
    after = response?.pageInfo?.endCursor || assets[assets.length - 1].node.id
  }

  return assets
}
