import { gql } from '@apollo/client'
import { getApolloClient } from '../apollo.server'
import type {
  ListTenantsQuery,
  ListTenantsQueryVariables,
  QueryTenantsArgs,
  WhoAmI,
  WhoAmIVariables
} from '~/generated/graphql'

export const whoami = async (request: Request) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.query<WhoAmI, WhoAmIVariables>({
    query: gql`
      query WhoAmI {
        whoami {
          id
          isOperator
        }
      }
    `
  })

  return response.data.whoami
}

export const listTenants = async (request: Request, args: QueryTenantsArgs) => {
  const apolloClient = await getApolloClient(request)
  const response = await apolloClient.query<
    ListTenantsQuery,
    ListTenantsQueryVariables
  >({
    query: gql`
      query ListTenantsQuery(
        $after: String
        $before: String
        $first: Int
        $last: Int
      ) {
        tenants(after: $after, before: $before, first: $first, last: $last) {
          edges {
            node {
              id
              email
              publicName
              idpConsentUrl
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

  return response.data.tenants
}

export const loadTenants = async (request: Request) => {
  let tenants: ListTenantsQuery['tenants']['edges'] = []
  let hasNextPage = true
  let after: string | undefined

  while (hasNextPage) {
    const response = await listTenants(request, { first: 100, after })

    if (!response.edges.length) {
      return []
    }
    if (response.edges) {
      tenants = [...tenants, ...response.edges]
    }

    hasNextPage = response.pageInfo.hasNextPage
    after = response?.pageInfo?.endCursor || tenants[tenants.length - 1].node.id
  }

  return tenants
}
