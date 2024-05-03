import { validate, version } from 'uuid'
import { URL, type URL as URLType } from 'url'
import { Context } from 'koa'
import { createHmac } from 'crypto'
import { canonicalize } from 'json-canonicalize'
import { IAppConfig } from '../config/app'

export function validateId(id: string): boolean {
  return validate(id) && version(id) === 4
}

export function isValidHttpUrl(receivedUrl: string): boolean {
  let url: URLType | undefined

  try {
    url = new URL(receivedUrl.trim())
  } catch (e) {
    return false
  }

  // Verify protocol
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }

  // Verify hostname
  if (url.hostname === '') return false

  // Check for empty domains or subdomains
  const parts = url.hostname.split('.')
  if (parts.indexOf('') !== -1) return false

  return true
}

export async function requestWithTimeout<T>(
  request: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId
  const timeout = async (): Promise<never> =>
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Request timed out')),
        timeoutMs
      )
    })

  const response = await Promise.race([request(), timeout()])
  clearTimeout(timeoutId)
  return response
}

interface PollArgs<T> {
  request(): Promise<T>
  stopWhen?(result: T): boolean
  pollingFrequencyMs: number
  timeoutMs: number
}

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function poll<T>(args: PollArgs<T>): Promise<T> {
  const {
    request,
    stopWhen = (response: T) => !!response,
    timeoutMs,
    pollingFrequencyMs
  } = args

  let elapsedTimeMs = 0
  let response: T

  do {
    const requestStart = Date.now()

    response = await requestWithTimeout(
      () => request(),
      timeoutMs - elapsedTimeMs
    )

    if (stopWhen(response)) {
      return response
    }

    elapsedTimeMs += Date.now() - requestStart + pollingFrequencyMs

    if (elapsedTimeMs >= timeoutMs) {
      throw new Error('Request timed out')
    }

    await sleep(pollingFrequencyMs)
    // eslint-disable-next-line no-constant-condition
  } while (true)
}

/**
 * Omit distrubuted to all types in a union.
 * @example
 * type WithoutA = UnionOmit<{ a: number; c: number } | { b: number }, 'a'> // { c: number } | { b: number }
 * const withoutAOK: WithoutA = { c: 1 } // OK
 * const withoutAOK2: WithoutA = { b: 1 } // OK
 * const withoutAError: WithoutA = { a: 1, c: 1 } // Error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnionOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never

export function verifyApiSignature(ctx: Context, config: IAppConfig): boolean {
  const { headers, body } = ctx.request
  const signature = headers['signature']
  if (!signature) {
    return false
  }

  const signatureParts = (signature as string)?.split(', ')
  const timestamp = signatureParts[0].split('=')[1]
  const signatureVersionAndDigest = signatureParts[1].split('=')
  const signatureVersion = signatureVersionAndDigest[0].replace('v', '')
  const signatureDigest = signatureVersionAndDigest[1]

  if (Number(signatureVersion) !== config.apiSignatureVersion) {
    return false
  }

  const payload = `${timestamp}.${canonicalize(body)}`
  const hmac = createHmac('sha256', config.apiSecret as string)
  hmac.update(payload)
  const digest = hmac.digest('hex')

  return digest === signatureDigest
}
