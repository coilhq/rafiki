import { ILPMiddleware, ILPContext } from '../rafiki'

export function createStreamAddressMiddleware(): ILPMiddleware {
  return async (
    { request, services: { streamServer, telemetry }, state }: ILPContext,
    next: () => Promise<void>
  ): Promise<void> => {
    const stopTimer = telemetry.startTimer(
      'create_stream_address_middleware_decode_tag',
      {
        callName: 'createStreamAddressMiddleware:decodePaymentTag'
      }
    )
    const { destination } = request.prepare
    // To preserve sender privacy, the accountId wasn't included in the original destination address.
    state.streamDestination = streamServer.decodePaymentTag(destination)
    stopTimer()
    await next()
  }
}
