import assert from 'assert'
import { OutgoingAccount, ZeroCopyIlpPrepare } from '../..'
import { IncomingAccountFactory, RafikiServicesFactory } from '../../factories'
import { createTelemetryMiddleware } from '../../middleware/telemetry'
import { createILPContext } from '../../utils'

import * as telemetry from '../../../../../../telemetry/transaction-amount'

const incomingAccount = IncomingAccountFactory.build({ id: 'alice' })

assert.ok(incomingAccount.id)
const services = RafikiServicesFactory.build({})

const ctx = createILPContext({
  services,
  request: {
    prepare: {
      amount: 100n
    } as unknown as ZeroCopyIlpPrepare,
    rawPrepare: Buffer.from('')
  },
  accounts: {
    incoming: incomingAccount,
    outgoing: { asset: { code: 'USD', scale: 2 } } as OutgoingAccount
  },
  state: {
    unfulfillable: false,
    incomingAccount: {
      quote: 'exists'
    }
  }
})

jest.mock('../../../../../../telemetry/transaction-amount')

const middleware = createTelemetryMiddleware()
const next = jest.fn().mockImplementation(() => Promise.resolve())

beforeEach(async () => {
  incomingAccount.balance = 100n
  incomingAccount.asset.scale = 2
  incomingAccount.asset.code = 'USD'
  ctx.state.unfulfillable = false
})

describe('Telemetry Middleware', function () {
  it('should call next without gathering telemetry when telemetry is not enabled (service is undefined)', async () => {
    const collectAmountSpy = jest
      .spyOn(telemetry, 'collectTelemetryAmount')
      .mockImplementation(() => Promise.resolve())

    const originalTelemetry = ctx.services.telemetry
    ctx.services.telemetry = undefined

    await middleware(ctx, next)

    expect(collectAmountSpy).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()

    ctx.services.telemetry = originalTelemetry
  })

  it('should call next without gathering telemetry when state is unfulfillable', async () => {
    ctx.state.unfulfillable = true

    const collectAmountSpy = jest.spyOn(telemetry, 'collectTelemetryAmount')

    await middleware(ctx, next)

    expect(collectAmountSpy).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('should handle invalid amount by calling next without gathering telemetry', async () => {
    ctx.request.prepare.amount = '0'

    const collectAmountSpy = jest.spyOn(telemetry, 'collectTelemetryAmount')

    await middleware(ctx, next)

    expect(collectAmountSpy).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })

  it('should collect telemetry', async () => {
    let resolveCollectAmount: () => void
    const collectAmountPromise = new Promise<void>((resolve) => {
      resolveCollectAmount = resolve
    })
    const collectAmountSpy = jest
      .spyOn(telemetry, 'collectTelemetryAmount')
      .mockImplementation(() => {
        resolveCollectAmount()
        return Promise.resolve()
      })

    await middleware(ctx, next)

    await collectAmountPromise

    expect(collectAmountSpy).toHaveBeenCalled()
  })
})
