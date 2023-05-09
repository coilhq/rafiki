import { GraphQLError } from 'graphql'
import { IMiddleware } from 'graphql-middleware'
import { ApolloContext } from '../../app'
import { CacheDataStore } from '../../middleware/cache/data-stores'
import { lockMiddleware, Lock } from '../../middleware/lock'
import { cacheMiddleware } from '../../middleware/cache'

export function lockGraphQLMutationMiddleware(lock: Lock): {
  Mutation: IMiddleware
} {
  return {
    Mutation: async (resolve, root, args, context: ApolloContext, info) => {
      return lockMiddleware({
        deps: { logger: context.logger, lock },
        next: () => resolve(root, args, context, info),
        key: args?.input?.idempotencyKey,
        onFailToAcquireLock: () => {
          throw new GraphQLError(
            `Concurrent request for idempotencyKey: ${args?.input?.idempotencyKey}`
          )
        }
      })
    }
  }
}

export function idempotencyGraphQLMiddleware(dataStore: CacheDataStore): {
  Mutation: IMiddleware
} {
  return {
    Mutation: async (resolve, root, args, context: ApolloContext, info) => {
      return cacheMiddleware({
        deps: { logger: context.logger, dataStore },
        idempotencyKey: args?.input?.idempotencyKey,
        request: () => resolve(root, args, context, info),
        requestParams: args,
        operationName: info.fieldName,
        handleParamMismatch: () => {
          throw new GraphQLError(
            `Incoming arguments are different than the original request for idempotencyKey: ${args?.input?.idempotencyKey}`
          )
        }
      })
    }
  }
}
