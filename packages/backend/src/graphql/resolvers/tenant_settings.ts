import { GraphQLError } from 'graphql'
import { TenantedApolloContext } from '../../app'
import { Pagination } from '../../shared/baseModel'
import { getPageInfo } from '../../shared/pagination'
import { TenantSetting } from '../../tenants/settings/model'
import {
  ResolversTypes,
  SortOrder,
  TenantResolvers,
  TenantSetting as SchemaTenantSetting,
  MutationResolvers
} from '../generated/graphql'
import { GraphQLErrorCode } from '../errors'

export const getTenantSettings: TenantResolvers<TenantedApolloContext>['settings'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['TenantSettingsConnection']> => {
    if (!parent.id) {
      throw new Error('missing tenant id')
    }

    const tenantSettingsService = await ctx.container.use(
      'tenantSettingService'
    )

    const { sortOrder, ...pagination } = args
    const order = sortOrder === 'ASC' ? SortOrder.Asc : SortOrder.Desc

    const tenantSettings = await tenantSettingsService.getPage(
      parent.id,
      pagination,
      order
    )
    const pageInfo = await getPageInfo({
      getPage: (pagination_?: Pagination, sortOrder_?: SortOrder) =>
        tenantSettingsService.getPage(parent.id!, pagination_, sortOrder_),
      page: tenantSettings
    })

    return {
      pageInfo,
      edges: tenantSettings.map((ts: TenantSetting) => ({
        cursor: ts.id,
        node: tenantSettingsToGraphql(ts)
      }))
    }
  }

export const createTenantSettings: MutationResolvers<TenantedApolloContext>['createTenantSettings'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['CreateTenantSettingsMutationResponse']> => {
    const tenantSettingService = await ctx.container.use('tenantSettingService')

    const tenantSettings = await tenantSettingService.create({
      tenantId: ctx.tenant.id,
      setting: args.input.settings
    })

    return {
      settings: tenantSettings.map((x) => tenantSettingsToGraphql(x))
    }
  }

export const deleteTenantSettings: MutationResolvers<TenantedApolloContext>['deleteTenantSettings'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['DeleteTenantSettingsMutationResponse']> => {
    const tenantSettingService = await ctx.container.use('tenantSettingService')

    try {
      await tenantSettingService.delete({
        tenantId: ctx.tenant.id,
        key: args.input.key
      })

      return { success: true }
    } catch (err) {
      throw new GraphQLError('failed to delete tenant setting', {
        extensions: {
          code: GraphQLErrorCode.InternalServerError
        }
      })
    }
  }

// export const updateTenantSetting: MutationResolvers<TenantedApolloContext>['updateTenantSetting'] =
//     async (
//         parent,
//         args,
//         ctx
//     ): Promise<ResolversTypes['UpdateTenantSettingMutationResponse']> => {
//         const tenantSettingService = await ctx.container.use('tenantSettingService')

//         try {
//             await tenantSettingService.update({
//                 key: args.input.key,
//                 value: args.input.value,
//                 tenantId: ctx.tenant.id,
//             })

//             return {
//                 setting: tenantSettingsToGraphql({})
//             }
//         }catch(err) {

//         }
//     }

export const tenantSettingsToGraphql = (
  tenantSetting: TenantSetting
): SchemaTenantSetting => ({
  key: tenantSetting.key,
  value: tenantSetting.value
})
