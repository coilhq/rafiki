import { ApolloContext } from '../../app'
import {
  QueryResolvers,
  ResolversTypes,
  WebhookEvent as SchemaWebhookEvent
} from '../generated/graphql'
import { getPageInfo } from '../../shared/pagination'
import { WebhookEvent } from '../../webhook/model'
import { Pagination, SortOrder } from '../../shared/baseModel'

export const getWebhookEvents: QueryResolvers<ApolloContext>['webhookEvents'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['WebhookEventsConnection']> => {
    const { filter, sortOrder, ...pagination } = args
    const order = sortOrder === 'asc' ? SortOrder.Asc : SortOrder.Desc
    const webhookService = await ctx.container.use('webhookService')
    const getPageFn = (pagination_: Pagination, sortOrder_?: SortOrder) =>
      webhookService.getPage({
        pagination: pagination_,
        filter,
        sortOrder: sortOrder_
      })
    const webhookEvents = await getPageFn(pagination, order)
    const pageInfo = await getPageInfo(
      (pagination_: Pagination, sortOrder_?: SortOrder) =>
        getPageFn(pagination_, sortOrder_),
      webhookEvents,
      order
    )
    return {
      pageInfo,
      edges: webhookEvents.map((webhookEvent: WebhookEvent) => ({
        cursor: webhookEvent.id,
        node: webhookEventToGraphql(webhookEvent)
      }))
    }
  }

export const webhookEventToGraphql = (
  webhookEvent: WebhookEvent
): SchemaWebhookEvent => ({
  id: webhookEvent.id,
  type: webhookEvent.type,
  data: webhookEvent.data,
  createdAt: new Date(webhookEvent.createdAt).toISOString()
})
