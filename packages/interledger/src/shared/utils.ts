import { Pojo, raw } from 'objection'
import { v4 as uuid, validate, version } from 'uuid'

export function bigIntToDbUuid(id: bigint): Pojo {
  return raw('?::uuid', [id.toString(16).padStart(32, '0')])
}

export function uuidToBigInt(id: string): bigint {
  return BigInt(`0x${id.replace(/-/g, '')}`)
}

export function randomId(): bigint {
  return uuidToBigInt(uuid())
}

export function validateId(id: string): boolean {
  return validate(id) && version(id) === 4
}
