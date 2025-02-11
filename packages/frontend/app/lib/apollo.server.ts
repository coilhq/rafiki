import { createHmac } from 'crypto'
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  createHttpLink
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { canonicalize } from 'json-canonicalize'
import { print } from 'graphql/language/printer'
import { getSession } from '~/lib/session.server'

/* eslint-disable no-var */
declare global {
  interface BigInt {
    toJSON(): string
  }
}
/* eslint-enable no-var */

// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function (this: bigint) {
  return this.toString()
}

async function createAuthLink(request: Request, tenantId?: string) {
  return setContext(async (gqlRequest, { headers }) => {
    const timestamp = Date.now()
    const version = process.env.SIGNATURE_VERSION
    const session = await getSession(request.headers.get('cookie'))
    const apiSecret = session.get('apiSecret')

    if (!apiSecret || !version) {
      return { headers }
    }

    const { query, variables, operationName } = gqlRequest
    const formattedRequest = {
      variables,
      operationName,
      query: print(query)
    }

    const payload = `${timestamp}.${canonicalize(formattedRequest)}`
    const hmac = createHmac('sha256', apiSecret)
    hmac.update(payload)
    const digest = hmac.digest('hex')

    const link = {
      headers: {
        ...headers,
        signature: `t=${timestamp}, v${version}=${digest}`
      }
    }

    const sessionTenantId = session.get('tenantId')
    if (sessionTenantId || tenantId) {
      // Use session tenant id if operator does not specify other tenant
      link.headers['tenant-id'] = tenantId ?? sessionTenantId
    }

    return link
  })
}

const httpLink = createHttpLink({
  uri: process.env.GRAPHQL_URL
})

export async function getApolloClient(request: Request, tenantId?: string) {
  return new ApolloClient({
    cache: new InMemoryCache({}),
    link: ApolloLink.from([await createAuthLink(request, tenantId), httpLink])
  })
}
