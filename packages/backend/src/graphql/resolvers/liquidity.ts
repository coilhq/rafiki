import { GraphQLError } from 'graphql'
import { GraphQLErrorCode } from '../errors'
import { walletAddressToGraphql } from './wallet_address'
import {
  ResolversTypes,
  MutationResolvers,
  LiquidityError,
  AssetResolvers,
  PeerResolvers,
  WalletAddressResolvers,
  IncomingPaymentResolvers,
  OutgoingPaymentResolvers,
  PaymentResolvers
} from '../generated/graphql'
import { ApolloContext, TenantedApolloContext } from '../../app'
import {
  fundingErrorToMessage,
  fundingErrorToCode,
  isFundingError
} from '../../open_payments/payment/outgoing/errors'
import {
  errorToCode as transferErrorToCode,
  errorToMessage as transferErrorToMessage
} from '../../accounting/errors'
import {
  isOutgoingPaymentEvent,
  OutgoingPaymentDepositType,
  OutgoingPaymentEventType
} from '../../open_payments/payment/outgoing/model'
import {
  PeerError,
  errorToMessage as peerErrorToMessage,
  errorToCode as peerErrorToCode
} from '../../payment-method/ilp/peer/errors'
import { IncomingPaymentEventType } from '../../open_payments/payment/incoming/model'

export const getAssetLiquidity: AssetResolvers<ApolloContext>['liquidity'] =
  async (parent, args, ctx): Promise<ResolversTypes['UInt64']> => {
    return await getPeerOrAssetLiquidity(ctx, parent.id as string)
  }

export const getPeerLiquidity: PeerResolvers<ApolloContext>['liquidity'] =
  async (parent, args, ctx): Promise<ResolversTypes['UInt64']> => {
    return await getPeerOrAssetLiquidity(ctx, parent.id as string)
  }

export const getWalletAddressLiquidity: WalletAddressResolvers<ApolloContext>['liquidity'] =
  async (parent, args, ctx): Promise<ResolversTypes['UInt64'] | null> => {
    return (await getLiquidity(ctx, parent.id as string)) ?? null
  }

export const getIncomingPaymentLiquidity: IncomingPaymentResolvers<ApolloContext>['liquidity'] =
  async (parent, args, ctx): Promise<ResolversTypes['UInt64'] | null> => {
    return (await getLiquidity(ctx, parent.id as string)) ?? null
  }

export const getOutgoingPaymentLiquidity: OutgoingPaymentResolvers<ApolloContext>['liquidity'] =
  async (parent, args, ctx): Promise<ResolversTypes['UInt64'] | null> => {
    return (await getLiquidity(ctx, parent.id as string)) ?? null
  }

export const getPaymentLiquidity: PaymentResolvers<ApolloContext>['liquidity'] =
  async (parent, args, ctx): Promise<ResolversTypes['UInt64'] | null> => {
    return (await getLiquidity(ctx, parent.id as string)) ?? null
  }

const getLiquidity = async (
  ctx: ApolloContext,
  id: string
): Promise<bigint | undefined> => {
  const accountingService = await ctx.container.use('accountingService')
  return await accountingService.getBalance(id)
}

const getPeerOrAssetLiquidity = async (
  ctx: ApolloContext,
  id: string
): Promise<bigint> => {
  const liquidity = await getLiquidity(ctx, id)
  if (liquidity === undefined) {
    throw new Error('No liquidity account found')
  }
  return liquidity
}

export const depositPeerLiquidity: MutationResolvers<ApolloContext>['depositPeerLiquidity'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    if (args.input.amount === BigInt(0)) {
      throw new GraphQLError(errorToMessage[LiquidityError.AmountZero], {
        extensions: {
          code: errorToCode[LiquidityError.AmountZero]
        }
      })
    }
    const peerService = await ctx.container.use('peerService')
    const peerOrError = await peerService.depositLiquidity({
      transferId: args.input.id,
      peerId: args.input.peerId,
      amount: args.input.amount
    })

    if (peerOrError === PeerError.UnknownPeer) {
      throw new GraphQLError(peerErrorToMessage[peerOrError], {
        extensions: {
          code: peerErrorToCode[peerOrError]
        }
      })
    } else if (isLiquidityError(peerOrError)) {
      throw new GraphQLError(errorToMessage[peerOrError], {
        extensions: {
          code: errorToCode[peerOrError]
        }
      })
    }

    return {
      success: true
    }
  }

export const depositAssetLiquidity: MutationResolvers<ApolloContext>['depositAssetLiquidity'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    if (args.input.amount === 0n) {
      throw new GraphQLError(errorToMessage[LiquidityError.AmountZero], {
        extensions: {
          code: errorToCode[LiquidityError.AmountZero]
        }
      })
    }
    const assetService = await ctx.container.use('assetService')
    const asset = await assetService.get(args.input.assetId)
    if (!asset) {
      throw new GraphQLError(errorToMessage[LiquidityError.UnknownAsset], {
        extensions: {
          code: errorToCode[LiquidityError.UnknownAsset]
        }
      })
    }
    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.createDeposit({
      id: args.input.id,
      account: asset,
      amount: args.input.amount
    })
    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

export const createPeerLiquidityWithdrawal: MutationResolvers<ApolloContext>['createPeerLiquidityWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const { amount, id, timeoutSeconds, peerId } = args.input
    if (args.input.amount === BigInt(0)) {
      throw new GraphQLError(errorToMessage[LiquidityError.AmountZero], {
        extensions: {
          code: errorToCode[LiquidityError.AmountZero]
        }
      })
    }
    const peerService = await ctx.container.use('peerService')
    const peer = await peerService.get(peerId)
    if (!peer) {
      throw new GraphQLError(errorToMessage[LiquidityError.UnknownPeer], {
        extensions: {
          code: errorToCode[LiquidityError.UnknownPeer]
        }
      })
    }
    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.createWithdrawal({
      id,
      account: peer,
      amount,
      timeout: Number(timeoutSeconds)
    })
    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

export const createAssetLiquidityWithdrawal: MutationResolvers<ApolloContext>['createAssetLiquidityWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const { amount, id, timeoutSeconds, assetId } = args.input
    if (amount === 0n) {
      throw new GraphQLError(errorToMessage[LiquidityError.AmountZero], {
        extensions: {
          code: errorToCode[LiquidityError.AmountZero]
        }
      })
    }
    const assetService = await ctx.container.use('assetService')
    const asset = await assetService.get(assetId)
    if (!asset) {
      throw new GraphQLError(errorToMessage[LiquidityError.UnknownAsset], {
        extensions: {
          code: errorToCode[LiquidityError.UnknownAsset]
        }
      })
    }
    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.createWithdrawal({
      id,
      account: asset,
      amount,
      timeout: Number(timeoutSeconds)
    })
    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

export const createWalletAddressWithdrawal: MutationResolvers<ApolloContext>['createWalletAddressWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['WalletAddressWithdrawalMutationResponse']> => {
    const { id, walletAddressId, timeoutSeconds } = args.input
    const walletAddressService = await ctx.container.use('walletAddressService')
    const walletAddress = await walletAddressService.get(walletAddressId)
    if (!walletAddress) {
      throw new GraphQLError(
        errorToMessage[LiquidityError.UnknownWalletAddress],
        {
          extensions: {
            code: errorToCode[LiquidityError.UnknownWalletAddress]
          }
        }
      )
    }
    const accountingService = await ctx.container.use('accountingService')
    const amount = await accountingService.getBalance(walletAddress.id)
    if (amount === undefined)
      throw new Error('missing incoming payment wallet address')
    if (amount === 0n) {
      throw new GraphQLError(errorToMessage[LiquidityError.AmountZero], {
        extensions: {
          code: errorToCode[LiquidityError.AmountZero]
        }
      })
    }
    const error = await accountingService.createWithdrawal({
      id,
      account: walletAddress,
      amount,
      timeout: Number(timeoutSeconds)
    })

    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      withdrawal: {
        id,
        amount,
        walletAddress: walletAddressToGraphql(walletAddress)
      }
    }
  }

export const postLiquidityWithdrawal: MutationResolvers<ApolloContext>['postLiquidityWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.postWithdrawal(
      args.input.withdrawalId
    )
    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

export const voidLiquidityWithdrawal: MutationResolvers<ApolloContext>['voidLiquidityWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.voidWithdrawal(
      args.input.withdrawalId
    )
    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

export const DepositEventType = OutgoingPaymentDepositType
export type DepositEventType = OutgoingPaymentDepositType

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
const isDepositEventType = (o: any): o is DepositEventType =>
  Object.values(DepositEventType).includes(o)

export const depositEventLiquidity: MutationResolvers<TenantedApolloContext>['depositEventLiquidity'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const webhookService = await ctx.container.use('webhookService')
    const event = await webhookService.getEvent(args.input.eventId)
    if (
      !event ||
      !isOutgoingPaymentEvent(event) ||
      !isDepositEventType(event.type)
    ) {
      throw new GraphQLError(errorToMessage[LiquidityError.InvalidId], {
        extensions: {
          code: errorToCode[LiquidityError.InvalidId]
        }
      })
    }
    if (!event.data.debitAmount) {
      throw new Error('missing debit amount')
    }
    const outgoingPaymentService = await ctx.container.use(
      'outgoingPaymentService'
    )
    const paymentOrErr = await outgoingPaymentService.fund({
      id: event.data.id,
      tenantId: ctx.tenant.id,
      amount: BigInt(event.data.debitAmount.value),
      transferId: event.id
    })
    if (isFundingError(paymentOrErr)) {
      throw new GraphQLError(fundingErrorToMessage[paymentOrErr], {
        extensions: {
          code: fundingErrorToCode[paymentOrErr]
        }
      })
    }
    return {
      success: true
    }
  }

export const withdrawEventLiquidity: MutationResolvers<ApolloContext>['withdrawEventLiquidity'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const webhookService = await ctx.container.use('webhookService')
    const event = await webhookService.getEvent(args.input.eventId)
    if (!event || !event.withdrawal) {
      throw new GraphQLError(errorToMessage[LiquidityError.InvalidId], {
        extensions: {
          code: errorToCode[LiquidityError.InvalidId]
        }
      })
    }
    const assetService = await ctx.container.use('assetService')
    const asset = await assetService.get(event.withdrawal.assetId)
    if (!asset) {
      throw new Error('asset id does not map to asset')
    }
    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.createWithdrawal({
      id: event.id,
      account: {
        id: event.withdrawal.accountId,
        asset
      },
      amount: event.withdrawal.amount
    })
    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    // TODO: check for and handle leftover incoming payment or payment balance
    return {
      success: true
    }
  }

export const depositOutgoingPaymentLiquidity: MutationResolvers<TenantedApolloContext>['depositOutgoingPaymentLiquidity'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const telemetry = await ctx.container.use('telemetry')
    const stopTimer = telemetry.startTimer(
      'deposit_outgoing_payment_liquidity_ms',
      {
        callName: 'Resolver:depositOutgoingPaymentLiquidity'
      }
    )

    try {
      const { outgoingPaymentId } = args.input
      const webhookService = await ctx.container.use('webhookService')
      const stopTimerWh = telemetry.startTimer('wh_get_latest_ms', {
        callName: 'WebhookService:getLatestByResourceId'
      })
      const event = await webhookService.getLatestByResourceId({
        outgoingPaymentId,
        types: [OutgoingPaymentDepositType.PaymentCreated]
      })
      stopTimerWh()
      if (!event || !isOutgoingPaymentEvent(event)) {
        throw new GraphQLError(errorToMessage[LiquidityError.InvalidId], {
          extensions: {
            code: errorToCode[LiquidityError.InvalidId]
          }
        })
      }

      if (!event.data.debitAmount) {
        throw new Error('No debit amount')
      }
      const outgoingPaymentService = await ctx.container.use(
        'outgoingPaymentService'
      )
      const stopTimerFund = telemetry.startTimer('fund_payment_ms', {
        callName: 'OutgoingPaymentService:fund'
      })
      const paymentOrErr = await outgoingPaymentService.fund({
        id: outgoingPaymentId,
        tenantId: ctx.tenant.id,
        amount: BigInt(event.data.debitAmount.value),
        transferId: event.id
      })
      stopTimerFund()

      if (isFundingError(paymentOrErr)) {
        throw new GraphQLError(fundingErrorToMessage[paymentOrErr], {
          extensions: {
            code: fundingErrorToCode[paymentOrErr]
          }
        })
      }
      return {
        success: true
      }
      // Not a useless catch. Wrapped resolver in try and simply re-throwing
      // errors to enforce stopTimer always being called once at end of the resolver
      // eslint-disable-next-line no-useless-catch
    } catch (err) {
      throw err
    } finally {
      stopTimer()
    }
  }

export const createIncomingPaymentWithdrawal: MutationResolvers<ApolloContext>['createIncomingPaymentWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const { incomingPaymentId, timeoutSeconds } = args.input
    const incomingPaymentService = await ctx.container.use(
      'incomingPaymentService'
    )
    const incomingPayment = await incomingPaymentService.get({
      id: incomingPaymentId
    })
    const webhookService = await ctx.container.use('webhookService')
    const event = await webhookService.getLatestByResourceId({
      incomingPaymentId,
      types: [
        IncomingPaymentEventType.IncomingPaymentCompleted,
        IncomingPaymentEventType.IncomingPaymentExpired
      ]
    })
    if (!incomingPayment || !incomingPayment.receivedAmount || !event?.id) {
      throw new GraphQLError(errorToMessage[LiquidityError.InvalidId], {
        extensions: {
          code: errorToCode[LiquidityError.InvalidId]
        }
      })
    }

    const accountingService = await ctx.container.use('accountingService')
    const error = await accountingService.createWithdrawal({
      id: event.id,
      account: {
        id: incomingPaymentId,
        asset: incomingPayment.asset
      },
      amount: incomingPayment.receivedAmount.value,
      timeout: Number(timeoutSeconds)
    })

    if (error) {
      throw new GraphQLError(fundingErrorToMessage[error], {
        extensions: {
          code: fundingErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

export const createOutgoingPaymentWithdrawal: MutationResolvers<ApolloContext>['createOutgoingPaymentWithdrawal'] =
  async (
    parent,
    args,
    ctx
  ): Promise<ResolversTypes['LiquidityMutationResponse']> => {
    const { outgoingPaymentId, timeoutSeconds } = args.input
    const outgoingPaymentService = await ctx.container.use(
      'outgoingPaymentService'
    )
    const outgoingPayment = await outgoingPaymentService.get({
      id: outgoingPaymentId
    })
    const webhookService = await ctx.container.use('webhookService')
    const event = await webhookService.getLatestByResourceId({
      outgoingPaymentId,
      types: [
        OutgoingPaymentEventType.PaymentCompleted,
        OutgoingPaymentEventType.PaymentFailed
      ]
    })
    if (!outgoingPayment || !event?.id) {
      throw new GraphQLError(errorToMessage[LiquidityError.InvalidId], {
        extensions: {
          code: errorToCode[LiquidityError.InvalidId]
        }
      })
    }

    const accountingService = await ctx.container.use('accountingService')
    const balance = await accountingService.getBalance(outgoingPayment.id)
    if (!balance) {
      throw new GraphQLError(
        errorToMessage[LiquidityError.InsufficientBalance],
        {
          extensions: {
            code: errorToCode[LiquidityError.InsufficientBalance]
          }
        }
      )
    }

    const error = await accountingService.createWithdrawal({
      id: event.id,
      account: {
        id: outgoingPaymentId,
        asset: outgoingPayment.asset
      },
      amount: balance,
      timeout: Number(timeoutSeconds)
    })

    if (error) {
      throw new GraphQLError(transferErrorToMessage[error], {
        extensions: {
          code: transferErrorToCode[error]
        }
      })
    }
    return {
      success: true
    }
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
const isLiquidityError = (o: any): o is LiquidityError =>
  Object.values(LiquidityError).includes(o)

const errorToCode: {
  [key in LiquidityError]: string
} = {
  [LiquidityError.AlreadyPosted]: GraphQLErrorCode.Conflict,
  [LiquidityError.AlreadyVoided]: GraphQLErrorCode.Conflict,
  [LiquidityError.AmountZero]: GraphQLErrorCode.Forbidden,
  [LiquidityError.InsufficientBalance]: GraphQLErrorCode.Forbidden,
  [LiquidityError.InvalidId]: GraphQLErrorCode.BadUserInput,
  [LiquidityError.TransferExists]: GraphQLErrorCode.Duplicate,
  [LiquidityError.UnknownAsset]: GraphQLErrorCode.NotFound,
  [LiquidityError.UnknownIncomingPayment]: GraphQLErrorCode.NotFound,
  [LiquidityError.UnknownPayment]: GraphQLErrorCode.NotFound,
  [LiquidityError.UnknownWalletAddress]: GraphQLErrorCode.NotFound,
  [LiquidityError.UnknownPeer]: GraphQLErrorCode.NotFound,
  [LiquidityError.UnknownTransfer]: GraphQLErrorCode.NotFound
}

const errorToMessage: {
  [key in LiquidityError]: string
} = {
  [LiquidityError.AlreadyPosted]: 'Transfer already posted',
  [LiquidityError.AlreadyVoided]: 'Transfer already voided',
  [LiquidityError.AmountZero]: 'Transfer amount is zero',
  [LiquidityError.InsufficientBalance]: 'Insufficient transfer balance',
  [LiquidityError.InvalidId]: 'Invalid transfer id',
  [LiquidityError.TransferExists]: 'Transfer already exists',
  [LiquidityError.UnknownAsset]: 'Unknown asset',
  [LiquidityError.UnknownIncomingPayment]: 'Unknown incoming payment',
  [LiquidityError.UnknownPayment]: 'Unknown transfer payment',
  [LiquidityError.UnknownWalletAddress]: 'Unknown wallet address',
  [LiquidityError.UnknownPeer]: 'Unknown peer',
  [LiquidityError.UnknownTransfer]: 'Unknown transfer'
}
