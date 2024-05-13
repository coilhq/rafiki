import { WalletAddressContext, SPSPContext } from '../../../app'

export type SPSPWalletAddressContext = WalletAddressContext & SPSPContext

export class SPSPRouteError extends Error {
  public status: number
  public details?: Record<string, unknown>

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SPSPRouteError'
    this.status = status
    this.details = details
  }
}

export function createSpspMiddleware(spspEnabled: boolean) {
  if (spspEnabled) {
    return spspMiddleware
  } else {
    return async (
      _ctx: SPSPWalletAddressContext,
      next: () => Promise<unknown>
    ): Promise<void> => {
      await next()
    }
  }
}

const spspMiddleware = async (
  ctx: SPSPWalletAddressContext,
  next: () => Promise<unknown>
): Promise<void> => {
  if (ctx.accepts('application/spsp4+json')) {
    ctx.paymentTag = ctx.walletAddress.id
    ctx.asset = {
      code: ctx.walletAddress.asset.code,
      scale: ctx.walletAddress.asset.scale
    }
    const spspRoutes = await ctx.container.use('spspRoutes')
    await spspRoutes.get(ctx)
  } else {
    await next()
  }
}
