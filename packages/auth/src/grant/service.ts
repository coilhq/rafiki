import { v4 } from 'uuid'
import { Transaction, TransactionOrKnex } from 'objection'

import { BaseService } from '../shared/baseService'
import { generateNonce, generateToken } from '../shared/utils'
import {
  Grant,
  GrantState,
  StartMethod,
  FinishMethod,
  InteractiveGrant,
  isInteractiveGrant
} from './model'
import { AccessRequest } from '../access/types'
import { AccessService } from '../access/service'

export interface GrantService {
  get(grantId: string): Promise<Grant | undefined>
  create(grantRequest: GrantRequest, trx?: Transaction): Promise<Grant>
  getByInteraction(interactId: string): Promise<InteractiveGrant | undefined>
  getByInteractionSession(
    interactId: string,
    interactNonce: string
  ): Promise<InteractiveGrant | undefined>
  issueGrant(grantId: string): Promise<Grant>
  getByContinue(
    continueId: string,
    continueToken: string,
    interactRef?: string
  ): Promise<Grant | null>
  rejectGrant(grantId: string): Promise<Grant | null>
  deleteGrant(continueId: string): Promise<boolean>
}

interface ServiceDependencies extends BaseService {
  accessService: AccessService
  knex: TransactionOrKnex
}

// datatracker.ietf.org/doc/html/draft-ietf-gnap-core-protocol#section-2
export interface GrantRequest {
  access_token: {
    access: AccessRequest[]
  }
  client: string
  clientKeyId: string
  interact?: {
    start: StartMethod[]
    finish?: {
      method: FinishMethod
      uri: string
      nonce: string
    }
  }
}

export interface GrantResponse {
  interact: {
    redirect: string
    finish: string
  }
  continue: {
    access_token: {
      value: string
    }
    uri: string
    wait: number
  }
}

export async function createGrantService({
  logger,
  accessService,
  knex
}: ServiceDependencies): Promise<GrantService> {
  const log = logger.child({
    service: 'GrantService'
  })
  const deps: ServiceDependencies = {
    logger: log,
    accessService,
    knex
  }
  return {
    get: (grantId: string) => get(grantId),
    create: (grantRequest: GrantRequest, trx?: Transaction) =>
      create(deps, grantRequest, trx),
    getByInteraction: (interactId: string) => getByInteraction(interactId),
    getByInteractionSession: (interactId: string, interactNonce: string) =>
      getByInteractionSession(interactId, interactNonce),
    issueGrant: (grantId: string) => issueGrant(deps, grantId),
    getByContinue: (
      continueId: string,
      continueToken: string,
      interactRef: string
    ) => getByContinue(continueId, continueToken, interactRef),
    rejectGrant: (grantId: string) => rejectGrant(deps, grantId),
    deleteGrant: (continueId: string) => deleteGrant(deps, continueId)
  }
}

async function get(grantId: string): Promise<Grant | undefined> {
  return Grant.query().findById(grantId)
}

async function issueGrant(
  deps: ServiceDependencies,
  grantId: string
): Promise<Grant> {
  return Grant.query().patchAndFetchById(grantId, {
    state: GrantState.Granted
  })
}

async function rejectGrant(
  deps: ServiceDependencies,
  grantId: string
): Promise<Grant | null> {
  return Grant.query(deps.knex).patchAndFetchById(grantId, {
    state: GrantState.Rejected
  })
}

async function deleteGrant(
  deps: ServiceDependencies,
  continueId: string
): Promise<boolean> {
  const deletion = await Grant.query(deps.knex).delete().where({ continueId })
  if (deletion === 0) {
    deps.logger.info(
      `Could not find grant corresponding to continueId: ${continueId}`
    )
    return false
  }
  return true
}

async function create(
  deps: ServiceDependencies,
  grantRequest: GrantRequest,
  trx?: Transaction
): Promise<Grant> {
  const { accessService, knex } = deps

  const {
    access_token: { access },
    interact,
    client,
    clientKeyId
  } = grantRequest

  const grantTrx = trx || (await Grant.startTransaction(knex))
  try {
    const grant = await Grant.query(grantTrx).insert({
      state: interact ? GrantState.Pending : GrantState.Granted,
      startMethod: interact?.start,
      finishMethod: interact?.finish?.method,
      finishUri: interact?.finish?.uri,
      clientNonce: interact?.finish?.nonce,
      client,
      clientKeyId,
      interactId: interact ? v4() : undefined,
      interactRef: interact ? v4() : undefined,
      interactNonce: interact ? generateNonce() : undefined,
      continueId: v4(),
      continueToken: generateToken()
    })

    // Associate provided accesses with grant
    await accessService.createAccess(grant.id, access, grantTrx)

    if (!trx) {
      await grantTrx.commit()
    }

    return grant
  } catch (err) {
    if (!trx) {
      await grantTrx.rollback()
    }

    throw err
  }
}

async function getByInteraction(
  interactId: string
): Promise<InteractiveGrant | undefined> {
  const grant = await Grant.query().findOne({ interactId })
  if (!grant || !isInteractiveGrant(grant)) {
    return undefined
  } else {
    return grant
  }
}

async function getByInteractionSession(
  interactId: string,
  interactNonce: string
): Promise<InteractiveGrant | undefined> {
  const grant = await Grant.query()
    .findOne({ interactId, interactNonce })
    .withGraphFetched('access')
  if (!grant || !isInteractiveGrant(grant)) {
    return undefined
  } else {
    return grant
  }
}

async function getByContinue(
  continueId: string,
  continueToken: string,
  interactRef?: string
): Promise<Grant | null> {
  const grant = await Grant.query().findOne({ continueId })
  if (
    continueToken !== grant?.continueToken ||
    (interactRef && interactRef !== grant?.interactRef)
  )
    return null
  return grant
}
