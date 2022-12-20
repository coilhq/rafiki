import {
  components as RSComponents,
  paths as RSPaths,
  operations as RSOperations
} from './openapi/generated/resource-server-types'
import {
  components as ASComponents,
  paths as ASPaths,
  operations as ASOperations
} from './openapi/generated/auth-server-types'

export const getRSPath = <P extends keyof RSPaths>(path: P): string =>
  path as string
export type IncomingPayment =
  RSComponents['schemas']['incoming-payment-with-connection']
export type CreateIncomingPaymentArgs =
  RSOperations['create-incoming-payment']['requestBody']['content']['application/json']
export type ILPStreamConnection =
  RSComponents['schemas']['ilp-stream-connection']
export type OutgoingPayment = RSComponents['schemas']['outgoing-payment']
export type CreateOutgoingPaymentArgs =
  RSOperations['create-outgoing-payment']['requestBody']['content']['application/json']
type PaginationResult<T> = {
  pagination: RSComponents['schemas']['page-info']
  result: T[]
}
export type OutgoingPaymentPaginationResult = PaginationResult<OutgoingPayment>
export type ForwardPagination =
  RSComponents['schemas']['forward-pagination'] & {
    last?: never
  }
export type BackwardPagination =
  RSComponents['schemas']['backward-pagination'] & {
    first?: never
  }
export type PaginationArgs = ForwardPagination | BackwardPagination
export type PaymentPointer = RSComponents['schemas']['payment-pointer']
export type JWK = RSComponents['schemas']['json-web-key']
export type JWKS = RSComponents['schemas']['json-web-key-set']
export type Quote = RSComponents['schemas']['quote']
export type CreateQuoteArgs =
  RSOperations['create-quote']['requestBody']['content']['application/json']

export const getASPath = <P extends keyof ASPaths>(path: P): string =>
  path as string
export type NonInteractiveGrantRequest = {
  access_token: ASOperations['post-request']['requestBody']['content']['application/json']['access_token']
  client: ASOperations['post-request']['requestBody']['content']['application/json']['client']
}
export type NonInteractiveGrant = {
  access_token: ASComponents['schemas']['access_token']
  continue: ASComponents['schemas']['continue']
}
export type GrantRequest = {
  access_token: ASOperations['post-request']['requestBody']['content']['application/json']['access_token']
  client: ASOperations['post-request']['requestBody']['content']['application/json']['client']
  interact: ASOperations['post-request']['requestBody']['content']['application/json']['interact']
}
export type GrantContinuationRequest = {
  interact_ref: ASOperations['post-continue']['requestBody']['content']['application/json']['interact_ref']
}
export type InteractiveGrant = {
  interact: ASComponents['schemas']['interact-response']
  continue: ASComponents['schemas']['continue']
}
export type AccessToken = {
  access_token: ASComponents['schemas']['access_token']
}
export const isInteractiveGrant = (
  grant: InteractiveGrant | NonInteractiveGrant
): grant is InteractiveGrant => !!(grant as InteractiveGrant).interact

export const isNonInteractiveGrant = (
  grant: InteractiveGrant | NonInteractiveGrant
): grant is NonInteractiveGrant => !!(grant as NonInteractiveGrant).access_token
