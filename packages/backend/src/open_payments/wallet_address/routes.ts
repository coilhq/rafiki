import { AccessAction } from '@interledger/open-payments'
import { WalletAddressSubresource } from './model'
import {
  WalletAddressService,
  WalletAddressSubresourceService
} from './service'
import { WalletAddressUrlContext, ListContext } from '../../app'
import {
  getPageInfo,
  parsePaginationQueryParameters
} from '../../shared/pagination'
import { OpenPaymentsServerRouteError } from '../route-errors'
import { IAppConfig } from '../../config/app'
import { ensureTrailingSlash } from '../../shared/utils'

interface ServiceDependencies {
  config: IAppConfig
  walletAddressService: WalletAddressService
}

export interface WalletAddressRoutes {
  get(ctx: WalletAddressUrlContext): Promise<void>
}

export function createWalletAddressRoutes(
  deps: ServiceDependencies
): WalletAddressRoutes {
  return {
    get: (ctx: WalletAddressUrlContext) => getWalletAddress(deps, ctx)
  }
}

export async function getWalletAddress(
  deps: ServiceDependencies,
  ctx: WalletAddressUrlContext
): Promise<void> {
  // The instance's wallet address is only relevant for the /jwks.json route, so "hide" it when directly requested
  if (ctx.walletAddressUrl === deps.config.walletAddressUrl) {
    throw new OpenPaymentsServerRouteError(404, 'Could not get wallet address')
  }

  const walletAddress = await deps.walletAddressService.getOrPollByUrl(
    ctx.walletAddressUrl
  )

  if (!walletAddress?.isActive) {
    throw new OpenPaymentsServerRouteError(
      404,
      'Could not get wallet address',
      {
        walletAddressUrl: ctx.walletAddressUrl
      }
    )
  }

  // We always fetch the additional properties, but not the properties that are not exposed to open-payments:
  walletAddress.additionalProperties =
    await deps.walletAddressService.getAdditionalProperties(
      walletAddress.id,
      true
    )

  ctx.body = walletAddress.toOpenPaymentsType({
    authServer: `${ensureTrailingSlash(deps.config.authServerGrantUrl)}${walletAddress.tenantId}`,
    resourceServer: `${ensureTrailingSlash(deps.config.openPaymentsUrl)}${walletAddress.tenantId}`
  })
}

interface ListSubresourceOptions<M extends WalletAddressSubresource> {
  ctx: ListContext
  getWalletAddressPage: WalletAddressSubresourceService<M>['getWalletAddressPage']
  toBody: (model: M) => Record<string, unknown>
}

export const listSubresource = async <M extends WalletAddressSubresource>({
  ctx,
  getWalletAddressPage,
  toBody
}: ListSubresourceOptions<M>) => {
  if (ctx.request.query.last) {
    if (ctx.request.query.first) {
      throw new OpenPaymentsServerRouteError(
        400,
        'first and last are mutually exclusive',
        { queryParams: ctx.request.query }
      )
    } else if (!ctx.request.query.cursor) {
      throw new OpenPaymentsServerRouteError(400, 'last requires cursor', {
        queryParams: ctx.request.query
      })
    }
  }
  const pagination = parsePaginationQueryParameters(ctx.request.query)
  const client = ctx.accessAction === AccessAction.List ? ctx.client : undefined
  const page = await getWalletAddressPage({
    walletAddressId: ctx.walletAddress.id,
    pagination,
    client,
    tenantId: ctx.params.tenantId
  })
  const pageInfo = await getPageInfo({
    getPage: (pagination) =>
      getWalletAddressPage({
        walletAddressId: ctx.walletAddress.id,
        pagination,
        client,
        tenantId: ctx.params.tenantId
      }),
    page,
    walletAddress: ctx.request.query['wallet-address']
  })
  const result = {
    pagination: pageInfo,
    result: page.map((item: M) => toBody(item))
  }
  ctx.body = result
}
