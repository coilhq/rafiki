import { createHmac } from 'crypto'
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  createHttpLink
} from '@apollo/client'
import type { NormalizedCacheObject } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { canonicalize } from 'json-canonicalize'
import { print } from 'graphql/language/printer'
import { getSession } from '~/lib/session.server'

/* eslint-disable no-var */
declare global {
  var __apolloClient: ApolloClient<NormalizedCacheObject> | undefined

  interface BigInt {
    toJSON(): string
  }
}
/* eslint-enable no-var */

// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function (this: bigint) {
  return this.toString()
}

const authLink = setContext(async (request, { headers }) => {
  if (!process.env.SIGNATURE_SECRET || !process.env.SIGNATURE_VERSION)
    return { headers }
  const timestamp = Math.round(new Date().getTime() / 1000)
  const version = process.env.SIGNATURE_VERSION

  const { query, variables, operationName } = request
  const formattedRequest = {
    variables,
    operationName,
    query: print(query)
  }

  const payload = `${timestamp}.${canonicalize(formattedRequest)}`
  const hmac = createHmac('sha256', process.env.SIGNATURE_SECRET)
  hmac.update(payload)
  const digest = hmac.digest('hex')

  const link = {
    headers: {
      ...headers,
      signature: `t=${timestamp}, v${version}=${digest}`
    }
  }

  const session = await getSession(headers.get('cookie'))
  const tenantId = session.get('tenantId')
  if (tenantId) {
    link.headers['x-tenant-id'] = tenantId
  }

  return link
})

const httpLink = createHttpLink({
  uri: process.env.GRAPHQL_URL
})

if (!global.__apolloClient) {
  global.__apolloClient = new ApolloClient({
    cache: new InMemoryCache({}),
    link: ApolloLink.from([authLink, httpLink]),
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache'
      },
      mutate: {
        fetchPolicy: 'no-cache'
      }
    }
  })
}
const apolloClient = global.__apolloClient

export { apolloClient }
