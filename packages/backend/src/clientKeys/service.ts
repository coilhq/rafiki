import { TransactionOrKnex } from 'objection'

import { ClientKeys } from './model'
import { BaseService } from '../shared/baseService'

export interface ClientKeysService {
  getKeyById(keyId: string): Promise<ClientKeys['jwk']>
}

interface ServiceDependencies extends BaseService {
  knex: TransactionOrKnex
}

export async function createClientKeysService({
  logger,
  knex
}: ServiceDependencies): Promise<ClientKeysService> {
  const log = logger.child({
    service: 'ClientKeysService'
  })
  const deps: ServiceDependencies = {
    logger: log,
    knex
  }
  return {
    getKeyById: (keyId) => getKeyById(deps, keyId)
  }
}

async function getKeyById(
  deps: ServiceDependencies,
  // In the form https://somedomain/keys/{keyId}
  keyId: string
): Promise<ClientKeys['jwk']> {
  const key = await ClientKeys.query(deps.knex).findById(keyId)
  if (!key) return null
  return key.jwk
}
