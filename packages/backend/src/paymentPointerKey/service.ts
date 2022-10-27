import { TransactionOrKnex } from 'objection'

import { PaymentPointerKey } from './model'
import { BaseService } from '../shared/baseService'
import { JWKWithRequired } from 'auth'

export interface PaymentPointerKeyService {
  create(options: CreateOptions): Promise<PaymentPointerKey>
  revokeKeyById(keyId: string): Promise<string>
  getKeysByPaymentPointerId(
    paymentPointerId: string
  ): Promise<PaymentPointerKey[]>
}

interface ServiceDependencies extends BaseService {
  knex: TransactionOrKnex
}

export async function createPaymentPointerKeyService({
  logger,
  knex
}: ServiceDependencies): Promise<PaymentPointerKeyService> {
  const log = logger.child({
    service: 'PaymentPointerKeyService'
  })
  const deps: ServiceDependencies = {
    logger: log,
    knex
  }
  return {
    create: (options) => create(deps, options),
    revokeKeyById: (keyId) => revokeKeyById(deps, keyId),
    getKeysByPaymentPointerId: (paymentPointerId) =>
      getKeysByPaymentPointerId(deps, paymentPointerId)
  }
}

interface CreateOptions {
  paymentPointerId: string
  jwk: JWKWithRequired
}

async function create(
  deps: ServiceDependencies,
  options: CreateOptions
): Promise<PaymentPointerKey> {
  const key = await PaymentPointerKey.query(deps.knex).insertAndFetch({
    paymentPointerId: options.paymentPointerId,
    jwk: options.jwk
  })
  return key
}

async function revokeKeyById(
  deps: ServiceDependencies,
  keyId: string
): Promise<string> {
  const key = await PaymentPointerKey.query(deps.knex).findById(keyId)

  const revokedJwk = key.jwk
  revokedJwk.revoked = true

  try {
    const revokedKey = await key
      .$query(deps.knex)
      .patchAndFetch({ jwk: revokedJwk })

    return revokedKey.id
  } catch (error) {
    deps.logger.error(
      {
        error
      },
      'error revoking key'
    )
    throw error
  }
}

async function getKeysByPaymentPointerId(
  deps: ServiceDependencies,
  paymentPointerId: string
): Promise<PaymentPointerKey[]> {
  const keys = await PaymentPointerKey.query(deps.knex).where({
    paymentPointerId
  })
  return keys
}
