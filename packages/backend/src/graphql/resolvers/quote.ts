import {
  MutationResolvers,
  Quote as SchemaQuote,
  WalletAddressResolvers,
  QueryResolvers,
  ResolversTypes
} from '../generated/graphql'
import {
  isQuoteError,
  errorToCode,
  errorToMessage
} from '../../open_payments/quote/errors'
import { Quote } from '../../open_payments/quote/model'
import { ForTenantIdContext, TenantedApolloContext } from '../../app'
import { getPageInfo } from '../../shared/pagination'
import { Pagination, SortOrder } from '../../shared/baseModel'
import { CreateQuoteOptions } from '../../open_payments/quote/service'
import { GraphQLError } from 'graphql'
import { GraphQLErrorCode } from '../errors'

export const getQuote: QueryResolvers<TenantedApolloContext>['quote'] = async (
  parent,
  args,
  ctx
): Promise<ResolversTypes['Quote']> => {
  const quoteService = await ctx.container.use('quoteService')
  const quote = await quoteService.get({
    id: args.id,
    tenantId: ctx.tenant.id
  })
  if (!quote) {
    throw new GraphQLError('quote does not exist', {
      extensions: {
        code: GraphQLErrorCode.NotFound
      }
    })
  }
  return quoteToGraphql(quote)
}

export const createQuote: MutationResolvers<ForTenantIdContext>['createQuote'] =
  async (parent, args, ctx): Promise<ResolversTypes['QuoteResponse']> => {
    const quoteService = await ctx.container.use('quoteService')
    const tenantId = ctx.forTenantId
    if (!tenantId)
      throw new GraphQLError(
        `Assignment to the specified tenant is not permitted`,
        {
          extensions: {
            code: GraphQLErrorCode.BadUserInput
          }
        }
      )
    const options: CreateQuoteOptions = {
      tenantId,
      walletAddressId: args.input.walletAddressId,
      receiver: args.input.receiver,
      method: 'ilp'
    }
    if (args.input.debitAmount) options.debitAmount = args.input.debitAmount
    if (args.input.receiveAmount)
      options.receiveAmount = args.input.receiveAmount
    const quoteOrError = await quoteService.create(options)
    if (isQuoteError(quoteOrError)) {
      throw new GraphQLError(errorToMessage[quoteOrError], {
        extensions: {
          code: errorToCode[quoteOrError]
        }
      })
    } else
      return {
        quote: quoteToGraphql(quoteOrError)
      }
  }

export const getWalletAddressQuotes: WalletAddressResolvers<TenantedApolloContext>['quotes'] =
  async (parent, args, ctx): Promise<ResolversTypes['QuoteConnection']> => {
    if (!parent.id) {
      throw new GraphQLError('missing wallet address id', {
        extensions: {
          code: GraphQLErrorCode.BadUserInput
        }
      })
    }
    const quoteService = await ctx.container.use('quoteService')
    const { sortOrder, ...pagination } = args
    const order = sortOrder === 'ASC' ? SortOrder.Asc : SortOrder.Desc
    const tenantId = ctx.isOperator ? undefined : ctx.tenant.id
    const quotes = await quoteService.getWalletAddressPage({
      walletAddressId: parent.id,
      pagination,
      sortOrder: order,
      tenantId
    })
    const pageInfo = await getPageInfo({
      getPage: (pagination: Pagination, sortOrder?: SortOrder) =>
        quoteService.getWalletAddressPage({
          walletAddressId: parent.id as string,
          pagination,
          sortOrder,
          tenantId
        }),
      page: quotes,
      sortOrder: order
    })
    return {
      pageInfo,
      edges: quotes.map((quote: Quote) => ({
        cursor: quote.id,
        node: quoteToGraphql(quote)
      }))
    }
  }

export function quoteToGraphql(quote: Quote): SchemaQuote {
  return {
    id: quote.id,
    tenantId: quote.tenantId,
    walletAddressId: quote.walletAddressId,
    receiver: quote.receiver,
    debitAmount: quote.debitAmount,
    receiveAmount: quote.receiveAmount,
    createdAt: new Date(+quote.createdAt).toISOString(),
    expiresAt: new Date(+quote.expiresAt).toISOString(),
    estimatedExchangeRate: quote.estimatedExchangeRate?.valueOf()
  }
}
