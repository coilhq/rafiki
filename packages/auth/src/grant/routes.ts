import { ParsedUrlQuery } from 'querystring'

import { AppContext } from '../app'
import { GrantService, GrantRequest as GrantRequestBody } from './service'
import {
  Grant,
  GrantFinalization,
  GrantState,
  toOpenPaymentPendingGrant,
  toOpenPaymentsGrant,
  toOpenPaymentsGrantContinuation,
  isRevokedGrant,
  isRejectedGrant
} from './model'
import { ClientService } from '../client/service'
import { BaseService } from '../shared/baseService'
import { IAppConfig } from '../config/app'
import { AccessTokenService } from '../accessToken/service'
import { AccessService } from '../access/service'
import { AccessToken } from '../accessToken/model'
import { InteractionService } from '../interaction/service'
import { canSkipInteraction } from './utils'
import { GNAPErrorCode, throwGNAPError } from '../shared/gnapErrors'

interface ServiceDependencies extends BaseService {
  grantService: GrantService
  clientService: ClientService
  accessTokenService: AccessTokenService
  accessService: AccessService
  interactionService: InteractionService
  config: IAppConfig
}

type GrantRequest<BodyT = never, QueryT = ParsedUrlQuery> = Exclude<
  AppContext['request'],
  'body'
> & {
  body: BodyT
  query: ParsedUrlQuery & QueryT
}

type GrantContext<BodyT = never, QueryT = ParsedUrlQuery> = Exclude<
  AppContext,
  'request'
> & {
  request: GrantRequest<BodyT, QueryT>
}

export type CreateContext = GrantContext<GrantRequestBody>

interface GrantContinueBody {
  interact_ref?: string
}

interface GrantParams {
  id: string
}
export type ContinueContext = GrantContext<GrantContinueBody, GrantParams>

export type RevokeContext = GrantContext<null, GrantParams>

export interface GrantRoutes {
  create(ctx: CreateContext): Promise<void>
  continue(ctx: ContinueContext): Promise<void>
  revoke(ctx: RevokeContext): Promise<void>
}

export function createGrantRoutes({
  grantService,
  clientService,
  accessTokenService,
  accessService,
  interactionService,
  logger,
  config
}: ServiceDependencies): GrantRoutes {
  const log = logger.child({
    service: 'GrantRoutes'
  })

  const deps = {
    grantService,
    clientService,
    accessTokenService,
    accessService,
    interactionService,
    logger: log,
    config
  }
  return {
    create: (ctx: CreateContext) => createGrant(deps, ctx),
    continue: (ctx: ContinueContext) => continueGrant(deps, ctx),
    revoke: (ctx: RevokeContext) => revokeGrant(deps, ctx)
  }
}

async function createGrant(
  deps: ServiceDependencies,
  ctx: CreateContext
): Promise<void> {
  let noInteractionRequired: boolean
  try {
    noInteractionRequired = canSkipInteraction(deps.config, ctx.request.body)
  } catch (err) {
    throwGNAPError(
      ctx,
      400,
      GNAPErrorCode.InvalidRequest,
      'access identifier required'
    )
  }
  if (noInteractionRequired) {
    await createApprovedGrant(deps, ctx)
  } else {
    await createPendingGrant(deps, ctx)
  }
}

async function createApprovedGrant(
  deps: ServiceDependencies,
  ctx: CreateContext
): Promise<void> {
  const { body } = ctx.request
  const { grantService, config } = deps
  const trx = await Grant.startTransaction()
  let grant: Grant
  let accessToken: AccessToken
  try {
    grant = await grantService.create(body, trx)
    accessToken = await deps.accessTokenService.create(grant.id, trx)
    await trx.commit()
  } catch (err) {
    await trx.rollback()
    throwGNAPError(
      ctx,
      500,
      GNAPErrorCode.RequestDenied,
      'internal server error'
    )
  }
  const access = await deps.accessService.getByGrant(grant.id)
  ctx.status = 200
  ctx.body = toOpenPaymentsGrant(
    grant,
    { authServerUrl: config.authServerDomain },
    accessToken,
    access
  )
}

async function createPendingGrant(
  deps: ServiceDependencies,
  ctx: CreateContext
): Promise<void> {
  const { body } = ctx.request
  const { grantService, interactionService, config } = deps
  if (!body.interact) {
    throwGNAPError(
      ctx,
      400,
      GNAPErrorCode.InvalidRequest,
      "missing required request field 'interact'"
    )
  }

  const client = await deps.clientService.get(body.client)
  if (!client) {
    throwGNAPError(
      ctx,
      400,
      GNAPErrorCode.InvalidClient,
      "missing required request field 'client'"
    )
  }

  const trx = await Grant.startTransaction()

  try {
    const grant = await grantService.create(body, trx)
    const interaction = await interactionService.create(grant.id, trx)
    await trx.commit()

    ctx.status = 200
    ctx.body = toOpenPaymentPendingGrant(grant, interaction, {
      client,
      authServerUrl: config.authServerDomain,
      waitTimeSeconds: config.waitTimeSeconds
    })
  } catch (err) {
    await trx.rollback()
    throwGNAPError(
      ctx,
      500,
      GNAPErrorCode.RequestDenied,
      'internal server error'
    )
  }
}

function isMatchingContinueRequest(
  reqContinueId: string,
  reqContinueToken: string,
  grant: Grant
): boolean {
  return (
    reqContinueId === grant.continueId &&
    reqContinueToken === grant.continueToken
  )
}

function isContinuableGrant(grant: Grant): boolean {
  return !isRejectedGrant(grant) && !isRevokedGrant(grant)
}

function isGrantStillWaiting(grant: Grant, waitTimeSeconds: number): boolean {
  const grantWaitTime = grant.lastContinuedAt.getTime() + waitTimeSeconds * 1000
  const currentTime = Date.now()

  return currentTime < grantWaitTime
}

async function pollGrantContinuation(
  deps: ServiceDependencies,
  ctx: ContinueContext,
  continueId: string,
  continueToken: string
): Promise<void> {
  const { config, grantService, accessService, accessTokenService } = deps

  const grant = await grantService.getByContinue(continueId, continueToken)
  if (!grant) {
    throwGNAPError(ctx, 404, GNAPErrorCode.InvalidRequest, 'grant not found')
  }

  if (isGrantStillWaiting(grant, config.waitTimeSeconds)) {
    throwGNAPError(
      ctx,
      400,
      GNAPErrorCode.TooFast,
      'polled grant faster than "wait" period'
    )
  }

  /*
    https://datatracker.ietf.org/doc/html/draft-ietf-gnap-core-protocol-15#name-continuing-during-pending-i
    "When the client instance does not include a finish parameter, the client instance will often need to poll the AS until the RO has authorized the request."
  */
  if (grant.finishMethod) {
    throwGNAPError(
      ctx,
      401,
      GNAPErrorCode.RequestDenied,
      'grant cannot be polled'
    )
  } else if (
    grant.state === GrantState.Pending ||
    grant.state === GrantState.Processing
  ) {
    await grantService.updateLastContinuedAt(grant.id)
    ctx.status = 200
    ctx.body = toOpenPaymentsGrantContinuation(grant, {
      authServerUrl: config.authServerDomain,
      waitTimeSeconds: config.waitTimeSeconds
    })
    return
  } else if (
    grant.state !== GrantState.Approved ||
    !isContinuableGrant(grant)
  ) {
    throwGNAPError(
      ctx,
      401,
      GNAPErrorCode.RequestDenied,
      'grant cannot be continued'
    )
  } else {
    const accessToken = await accessTokenService.create(grant.id)
    const access = await accessService.getByGrant(grant.id)
    await grantService.finalize(grant.id, GrantFinalization.Issued)
    ctx.status = 200
    ctx.body = toOpenPaymentsGrant(
      grant,
      {
        authServerUrl: config.authServerDomain
      },
      accessToken,
      access
    )
    return
  }
}

/* 
  GNAP indicates that a grant may be continued even if it didn't require interaction.
  Rafiki only needs to continue a grant if it required an interaction, noninteractive grants immediately issue an access token without needing continuation
  so continuation only expects interactive grants to be continued.
*/
async function continueGrant(
  deps: ServiceDependencies,
  ctx: ContinueContext
): Promise<void> {
  const { id: continueId } = ctx.params
  const continueToken = (ctx.headers['authorization'] as string)?.split(
    'GNAP '
  )[1]

  if (!continueId || !continueToken) {
    throwGNAPError(
      ctx,
      401,
      GNAPErrorCode.InvalidContinuation,
      'missing continuation information'
    )
  }

  const {
    config,
    accessTokenService,
    grantService,
    accessService,
    interactionService
  } = deps

  if (!ctx.request.body || Object.keys(ctx.request.body).length === 0) {
    await pollGrantContinuation(deps, ctx, continueId, continueToken)
    return
  }

  const { interact_ref: interactRef } = ctx.request.body
  if (!interactRef) {
    throwGNAPError(
      ctx,
      401,
      GNAPErrorCode.InvalidRequest,
      'missing interaction reference'
    )
  }

  const interaction = await interactionService.getByRef(interactRef)
  // TODO: distinguish error reasons between missing interaction, revoked, etc.
  // https://github.com/interledger/rafiki/issues/2344
  if (
    !interaction ||
    !isContinuableGrant(interaction.grant) ||
    !isMatchingContinueRequest(continueId, continueToken, interaction.grant)
  ) {
    throwGNAPError(
      ctx,
      404,
      GNAPErrorCode.InvalidContinuation,
      'grant not found'
    )
  } else if (isGrantStillWaiting(interaction.grant, config.waitTimeSeconds)) {
    throwGNAPError(
      ctx,
      400,
      GNAPErrorCode.TooFast,
      'continued grant faster than "wait" period'
    )
  } else {
    const { grant } = interaction
    if (grant.state !== GrantState.Approved) {
      throwGNAPError(
        ctx,
        401,
        GNAPErrorCode.RequestDenied,
        'grant interaction not approved'
      )
    }

    const accessToken = await accessTokenService.create(grant.id)
    const access = await accessService.getByGrant(grant.id)
    await grantService.finalize(grant.id, GrantFinalization.Issued)

    // TODO: add "continue" to response if additional grant request steps are added
    ctx.body = toOpenPaymentsGrant(
      interaction.grant,
      { authServerUrl: config.authServerDomain },
      accessToken,
      access
    )
  }
}

async function revokeGrant(
  deps: ServiceDependencies,
  ctx: RevokeContext
): Promise<void> {
  const { id: continueId } = ctx.params
  const continueToken = (ctx.headers['authorization'] as string)?.split(
    'GNAP '
  )[1]
  if (!continueId || !continueToken) {
    throwGNAPError(
      ctx,
      401,
      GNAPErrorCode.InvalidRequest,
      'invalid continuation information'
    )
  }
  const grant = await deps.grantService.getByContinue(continueId, continueToken)
  if (!grant) {
    throwGNAPError(ctx, 404, GNAPErrorCode.InvalidRequest, 'unknown grant')
  }

  const revoked = await deps.grantService.revokeGrant(grant.id)
  if (!revoked) {
    throwGNAPError(ctx, 404, GNAPErrorCode.InvalidRequest, 'invalid grant')
  }
  ctx.status = 204
}
