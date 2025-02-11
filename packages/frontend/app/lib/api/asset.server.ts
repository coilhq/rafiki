import { gql } from '@apollo/client'
import type {
  DepositAssetLiquidityInput,
  DepositAssetLiquidityMutation,
  DepositAssetLiquidityMutationVariables,
  CreateAssetInput,
  CreateAssetLiquidityWithdrawalInput,
  CreateAssetMutation,
  CreateAssetMutationVariables,
  DeleteAssetInput,
  DeleteAssetMutation,
  DeleteAssetMutationVariables,
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
import { getApolloClient } from '../apollo.server'

export const getAssetInfo = async (request: Request, args: QueryAssetArgs) => {
  const apolloClient = await getApolloClient(request)
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

export const getAssetWithFees = async (
  request: Request,
  args: QueryAssetArgs
) => {
  const apolloClient = await getApolloClient(request)
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

export const listAssets = async (request: Request, args: QueryAssetsArgs) => {
  const apolloClient = await getApolloClient(request)
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
              tenantId
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

export const createAsset = async (
  request: Request,
  args: CreateAssetInput,
  tenantId?: string
) => {
  const apolloClient = await getApolloClient(request, tenantId)
  const response = await apolloClient.mutate<
    CreateAssetMutation,
    CreateAssetMutationVariables
  >({
    mutation: gql`
      mutation CreateAssetMutation($input: CreateAssetInput!) {
        createAsset(input: $input) {
          asset {
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
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.createAsset
}

export const updateAsset = async (request: Request, args: UpdateAssetInput) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.mutate<
    UpdateAssetMutation,
    UpdateAssetMutationVariables
  >({
    mutation: gql`
      mutation UpdateAssetMutation($input: UpdateAssetInput!) {
        updateAsset(input: $input) {
          asset {
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
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.updateAsset
}

export const setFee = async (request: Request, args: SetFeeInput) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.mutate<
    SetFeeMutation,
    SetFeeMutationVariables
  >({
    mutation: gql`
      mutation SetFeeMutation($input: SetFeeInput!) {
        setFee(input: $input) {
          fee {
            assetId
            basisPoints
            createdAt
            fixed
            id
            type
          }
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
  request: Request,
  args: DepositAssetLiquidityInput
) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.mutate<
    DepositAssetLiquidityMutation,
    DepositAssetLiquidityMutationVariables
  >({
    mutation: gql`
      mutation DepositAssetLiquidityMutation(
        $input: DepositAssetLiquidityInput!
      ) {
        depositAssetLiquidity(input: $input) {
          success
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
  request: Request,
  args: CreateAssetLiquidityWithdrawalInput
) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.mutate<
    WithdrawAssetLiquidity,
    WithdrawAssetLiquidityVariables
  >({
    mutation: gql`
      mutation WithdrawAssetLiquidity(
        $input: CreateAssetLiquidityWithdrawalInput!
      ) {
        createAssetLiquidityWithdrawal(input: $input) {
          success
        }
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.createAssetLiquidityWithdrawal
}

export const loadAssets = async (request: Request) => {
  let assets: ListAssetsQuery['assets']['edges'] = []
  let hasNextPage = true
  let after: string | undefined

  while (hasNextPage) {
    const response = await listAssets(request, { first: 100, after })

    if (!response.edges.length) {
      return []
    }
    if (response.edges) {
      assets = [...assets, ...response.edges]
    }

    hasNextPage = response.pageInfo.hasNextPage
    after = response?.pageInfo?.endCursor || assets[assets.length - 1].node.id
  }

  return assets
}

export const deleteAsset = async (request: Request, args: DeleteAssetInput) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.mutate<
    DeleteAssetMutation,
    DeleteAssetMutationVariables
  >({
    mutation: gql`
      mutation DeleteAssetMutation($input: DeleteAssetInput!) {
        deleteAsset(input: $input) {
          asset {
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
      }
    `,
    variables: {
      input: args
    }
  })

  return response.data?.deleteAsset
}
