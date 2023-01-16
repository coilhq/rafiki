import { HttpMethod } from 'openapi'
import {
  ResourceRequestArgs,
  RouteDeps,
  UnauthenticatedResourceRequestArgs
} from '.'
import {
  getASPath,
  InteractiveGrant,
  NonInteractiveGrant,
  GrantRequest,
  GrantContinuationRequest
} from '../types'
import { post, deleteRequest } from './requests'

export interface GrantRouteDeps extends RouteDeps {
  client: string
}

export interface GrantRoutes {
  request(
    postArgs: UnauthenticatedResourceRequestArgs,
    args: Omit<GrantRequest, 'client'>
  ): Promise<InteractiveGrant | NonInteractiveGrant>
  continue(
    postArgs: ResourceRequestArgs,
    args: GrantContinuationRequest
  ): Promise<NonInteractiveGrant>
  cancel(postArgs: ResourceRequestArgs): Promise<void>
}

export const createGrantRoutes = (deps: GrantRouteDeps): GrantRoutes => {
  const requestGrantValidator = deps.openApi.createResponseValidator<
    InteractiveGrant | NonInteractiveGrant
  >({
    path: getASPath('/'),
    method: HttpMethod.POST
  })
  const continueGrantValidator =
    deps.openApi.createResponseValidator<NonInteractiveGrant>({
      path: getASPath('/continue/{id}'),
      method: HttpMethod.POST
    })
  const cancelGrantValidator = deps.openApi.createResponseValidator({
    path: getASPath('/continue/{id}'),
    method: HttpMethod.DELETE
  })

  return {
    request: (
      { url }: UnauthenticatedResourceRequestArgs,
      args: Omit<GrantRequest, 'client'>
    ) =>
      post(
        deps,
        {
          url,
          body: {
            ...args,
            client: deps.client
          }
        },
        requestGrantValidator
      ),
    continue: (
      { url, accessToken }: ResourceRequestArgs,
      args: GrantContinuationRequest
    ) =>
      post(
        deps,
        {
          url,
          accessToken,
          body: args
        },
        continueGrantValidator
      ),
    cancel: ({ url, accessToken }: ResourceRequestArgs) =>
      deleteRequest(
        deps,
        {
          url,
          accessToken
        },
        cancelGrantValidator
      )
  }
}
