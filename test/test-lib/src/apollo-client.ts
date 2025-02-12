import type { NormalizedCacheObject } from '@apollo/client'
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { print } from 'graphql/language/printer'
import { createHmac } from 'crypto'
import { canonicalize } from 'json-canonicalize'

interface CreateApolloClientArgs {
  graphqlUrl: string
  signatureSecret?: string
  signatureVersion?: string
}

export function createApolloClient(
  args: CreateApolloClientArgs
): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({
    uri: args.graphqlUrl
  })

  const authLink = setContext((request, { headers }) => {
    if (!args.signatureSecret || !args.signatureVersion) return { headers }
    const timestamp = Date.now()

    const { query, variables, operationName } = request
    const formattedRequest = {
      variables,
      operationName,
      query: print(query)
    }

    const payload = `${timestamp}.${canonicalize(formattedRequest)}`
    const hmac = createHmac('sha256', args.signatureSecret)
    hmac.update(payload)
    const digest = hmac.digest('hex')
    return {
      headers: {
        ...headers,
        signature: `t=${timestamp}, v${args.signatureVersion}=${digest}`
      }
    }
  })

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([authLink, httpLink]),
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache'
      },
      mutate: {
        fetchPolicy: 'no-cache'
      },
      watchQuery: {
        fetchPolicy: 'no-cache'
      }
    }
  })
}
