import { createILPContext } from '../../utils'
import { createOutgoingExpireMiddleware } from '../../middleware/expire'
import { IlpPrepareFactory, RafikiServicesFactory } from '../../factories'
import { ZeroCopyIlpPrepare } from '../../middleware/ilp-packet'
import { Errors } from 'ilp-packet'
const { TransferTimedOutError } = Errors

describe('Expire Middleware', function () {
  beforeAll(async (): Promise<void> => {
    jest.useFakeTimers()
  })

  afterAll(async (): Promise<void> => {
    jest.useRealTimers()
  })

  it('throws error if out of expiry window', async () => {
    const prepare = IlpPrepareFactory.build({
      expiresAt: new Date(Date.now() + 10 * 1000)
    })
    const ctx = createILPContext({
      services: RafikiServicesFactory.build(),
      request: {
        prepare: new ZeroCopyIlpPrepare(prepare),
        rawPrepare: Buffer.alloc(0) // ignored
      }
    })
    const next = jest.fn().mockImplementation(async () => {
      jest.advanceTimersByTime(11 * 1000)
    })
    const middleware = createOutgoingExpireMiddleware()

    await expect(middleware(ctx, next)).rejects.toBeInstanceOf(
      TransferTimedOutError
    )
  })

  it("doesn't throw if within expire window", async () => {
    const prepare = IlpPrepareFactory.build({
      expiresAt: new Date(Date.now() + 10 * 1000)
    })
    const ctx = createILPContext({
      services: RafikiServicesFactory.build(),
      request: {
        prepare: new ZeroCopyIlpPrepare(prepare),
        rawPrepare: Buffer.alloc(0) // ignored
      }
    })
    const next = jest.fn().mockImplementation(async () => {
      jest.advanceTimersByTime(9 * 1000)
    })
    const middleware = createOutgoingExpireMiddleware()

    await expect(middleware(ctx, next)).resolves.toBeUndefined()
  })
})
