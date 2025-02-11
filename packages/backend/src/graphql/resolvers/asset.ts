import {
  QueryResolvers,
  ResolversTypes,
  Asset as SchemaAsset,
  MutationResolvers,
  AssetResolvers
} from '../generated/graphql'
import { Asset } from '../../asset/model'
import { errorToCode, errorToMessage, isAssetError } from '../../asset/errors'
import { TenantedApolloContext } from '../../app'
import { getPageInfo } from '../../shared/pagination'
import { Pagination, SortOrder } from '../../shared/baseModel'
import { feeToGraphql } from './fee'
import { Fee, FeeType } from '../../fee/model'
import { GraphQLError } from 'graphql'
import { GraphQLErrorCode } from '../errors'

export const getAssets: QueryResolvers<TenantedApolloContext>['assets'] =
  async (parent, args, ctx): Promise<ResolversTypes['AssetsConnection']> => {
    const assetService = await ctx.container.use('assetService')
    const { sortOrder, ...pagination } = args
    const order = sortOrder === 'ASC' ? SortOrder.Asc : SortOrder.Desc
    const assets = await assetService.getPage({
      pagination,
      sortOrder: order,
      tenantId: ctx.isOperator ? undefined : ctx.tenant.id
    })
    const pageInfo = await getPageInfo({
      getPage: (pagination: Pagination, sortOrder?: SortOrder) =>
        assetService.getPage({
          pagination,
          sortOrder,
          tenantId: ctx.isOperator ? undefined : ctx.tenant.id
        }),
      page: assets,
      sortOrder: order
    })
    return {
      pageInfo,
      edges: assets.map((asset: Asset) => ({
        cursor: asset.id,
        node: assetToGraphql(asset)
      }))
    }
  }

export const getAsset: QueryResolvers<TenantedApolloContext>['asset'] = async (
  parent,
  args,
  ctx
): Promise<ResolversTypes['Asset']> => {
  const assetService = await ctx.container.use('assetService')
  const asset = await assetService.get(args.id, ctx.tenant.id)
  if (!asset) {
    throw new GraphQLError('Asset not found', {
      extensions: {
        code: GraphQLErrorCode.NotFound
      }
    })
  }
  return assetToGraphql(asset)
}

export const getAssetByCodeAndScale: QueryResolvers<TenantedApolloContext>['assetByCodeAndScale'] =
  async (parent, args, ctx): Promise<ResolversTypes['Asset'] | null> => {
    const assetService = await ctx.container.use('assetService')
    const asset = await assetService.getByCodeAndScale({
      code: args.code,
      scale: args.scale,
      tenantId: ctx.tenant.id
    })
    return asset ? assetToGraphql(asset) : null
  }

export const createAsset: MutationResolvers<TenantedApolloContext>['createAsset'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['AssetMutationResponse']> => {
    const assetService = await ctx.container.use('assetService')
    const assetOrError = await assetService.create({
      ...args.input,
      tenantId: ctx.tenant.id
    })
    if (isAssetError(assetOrError)) {
      throw new GraphQLError(errorToMessage[assetOrError], {
        extensions: {
          code: errorToCode[assetOrError]
        }
      })
    }
    return {
      asset: assetToGraphql(assetOrError)
    }
  }

export const updateAsset: MutationResolvers<TenantedApolloContext>['updateAsset'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['AssetMutationResponse']> => {
    const assetService = await ctx.container.use('assetService')
    const assetOrError = await assetService.update({
      id: args.input.id,
      withdrawalThreshold: args.input.withdrawalThreshold ?? null,
      liquidityThreshold: args.input.liquidityThreshold ?? null,
      tenantId: ctx.tenant.id
    })
    if (isAssetError(assetOrError)) {
      throw new GraphQLError(errorToMessage[assetOrError], {
        extensions: {
          code: errorToCode[assetOrError]
        }
      })
    }
    return {
      asset: assetToGraphql(assetOrError)
    }
  }

export const getAssetSendingFee: AssetResolvers<TenantedApolloContext>['sendingFee'] =
  async (parent, args, ctx): Promise<ResolversTypes['Fee'] | null> => {
    if (!parent.id) return null

    const feeService = await ctx.container.use('feeService')
    const fee = await feeService.getLatestFee(parent.id, FeeType.Sending)

    if (!fee) return null

    return feeToGraphql(fee)
  }

export const getAssetReceivingFee: AssetResolvers<TenantedApolloContext>['receivingFee'] =
  async (parent, args, ctx): Promise<ResolversTypes['Fee'] | null> => {
    if (!parent.id) return null

    const feeService = await ctx.container.use('feeService')
    const fee = await feeService.getLatestFee(parent.id, FeeType.Receiving)

    if (!fee) return null

    return feeToGraphql(fee)
  }

export const getFees: AssetResolvers<TenantedApolloContext>['fees'] = async (
  parent,
  args,
  ctx
): Promise<ResolversTypes['FeesConnection']> => {
  const { sortOrder, ...pagination } = args
  const feeService = await ctx.container.use('feeService')
  const getPageFn = (pagination_: Pagination, sortOrder_?: SortOrder) => {
    if (!parent.id) throw new Error('missing asset id')
    return feeService.getPage(parent.id, pagination_, sortOrder_)
  }
  const order = sortOrder === 'ASC' ? SortOrder.Asc : SortOrder.Desc
  const fees = await getPageFn(pagination, order)
  const pageInfo = await getPageInfo({
    getPage: (pagination_: Pagination, sortOrder_?: SortOrder) =>
      getPageFn(pagination_, sortOrder_),
    page: fees,
    sortOrder
  })
  return {
    pageInfo,
    edges: fees.map((fee: Fee) => ({
      cursor: fee.id,
      node: feeToGraphql(fee)
    }))
  }
}

export const deleteAsset: MutationResolvers<TenantedApolloContext>['deleteAsset'] =
  async (
    _,
    args,
    ctx
  ): Promise<ResolversTypes['DeleteAssetMutationResponse']> => {
    const assetService = await ctx.container.use('assetService')
    const assetOrError = await assetService.delete({
      id: args.input.id,
      tenantId: ctx.tenant.id,
      deletedAt: new Date()
    })

    if (isAssetError(assetOrError)) {
      throw new GraphQLError(errorToMessage[assetOrError], {
        extensions: {
          code: errorToCode[assetOrError]
        }
      })
    }
    return {
      asset: assetToGraphql(assetOrError)
    }
  }

export const assetToGraphql = (asset: Asset): SchemaAsset => ({
  id: asset.id,
  code: asset.code,
  scale: asset.scale,
  withdrawalThreshold: asset.withdrawalThreshold,
  liquidityThreshold: asset.liquidityThreshold,
  createdAt: new Date(+asset.createdAt).toISOString(),
  tenantId: asset.tenantId
})
