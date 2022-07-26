import { Logger } from 'pino'
import { Access } from '../access/model'
import { AppContext } from '../app'
import { IAppConfig } from '../config/app'
import { AccessTokenService, Introspection } from './service'
import { accessToBody } from '../shared/utils'
import { ClientService } from '../client/service'

interface ServiceDependencies {
  config: IAppConfig
  logger: Logger
  accessTokenService: AccessTokenService
  clientService: ClientService
}

export interface AccessTokenRoutes {
  introspect(ctx: AppContext): Promise<void>
  revoke(ctx: AppContext): Promise<void>
  rotate(ctx: AppContext): Promise<void>
}

export function createAccessTokenRoutes(
  deps_: ServiceDependencies
): AccessTokenRoutes {
  const logger = deps_.logger.child({
    service: 'AccessTokenRoutes'
  })
  const deps = { ...deps_, logger }
  return {
    introspect: (ctx: AppContext) => introspectToken(deps, ctx),
    revoke: (ctx: AppContext) => revokeToken(deps, ctx),
    rotate: (ctx: AppContext) => rotateToken(deps, ctx)
  }
}

async function introspectToken(
  deps: ServiceDependencies,
  ctx: AppContext
): Promise<void> {
  const { body } = ctx.request
  if (!body['access_token']) {
    ctx.status = 400
    ctx.body = {
      error: 'invalid_request',
      message: 'invalid introspection request'
    }
    return
  }

  const introspectionResult = await deps.accessTokenService.introspect(
    body['access_token']
  )
  if (introspectionResult) {
    ctx.body = introspectionToBody(introspectionResult)
  } else {
    ctx.status = 404
    ctx.body = {
      error: 'invalid_request',
      message: 'token not found'
    }
    return
  }
}

function introspectionToBody(result: Introspection) {
  if (!result.active) return { active: result.active }
  else {
    return {
      active: result.active,
      grant: result.id,
      access: result.access?.map((a: Access) => accessToBody(a)),
      key: result.key,
      client_id: result.clientId
    }
  }
}

async function revokeToken(
  deps: ServiceDependencies,
  ctx: AppContext
): Promise<void> {
  const sig = ctx.headers['signature']
  const sigInput = ctx.headers['signature-input']

  if (
    !sig ||
    !sigInput ||
    typeof sig !== 'string' ||
    typeof sigInput !== 'string'
  ) {
    ctx.status = 400
    ctx.body = {
      error: 'invalid_request'
    }
    return
  }

  const verified = await deps.clientService.verifySigFromBoundKey(
    sig,
    sigInput,
    'managementId',
    ctx.params['managementId'],
    ctx
  )
  if (!verified.success) {
    ctx.status = verified.status || 401
    ctx.body = {
      error: verified.error || 'invalid_client'
    }
  }

  const { id: managementId } = ctx.params
  await deps.accessTokenService.revoke(managementId)
  ctx.status = 204
}

async function rotateToken(
  deps: ServiceDependencies,
  ctx: AppContext
): Promise<void> {
  //TODO: verify accessToken with httpsig method
  const { id: managementId } = ctx.params
  const result = await deps.accessTokenService.rotate(managementId)
  if (result.success == true) {
    ctx.status = 200
    ctx.body = {
      access_token: {
        access: result.access.map((a) => accessToBody(a)),
        value: result.value,
        manage: result.managementId,
        expires_in: result.expiresIn
      }
    }
  } else {
    ctx.status = 404
    return ctx.throw(ctx.status, result.error.message)
  }
}
