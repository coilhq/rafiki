import { AppContext, AppServices } from '../app'
import { createContext } from '../tests/context'
import {
  OpenPaymentsServerRouteError,
  openPaymentServerErrorMiddleware
} from './errors'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '..'
import { Config } from '../config/app'
import { OpenAPIValidatorMiddlewareError } from '@interledger/openapi'

describe('openPaymentServerErrorMiddleware', (): void => {
  let deps: IocContract<AppServices>
  let ctx: AppContext

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer(Config)
  })

  beforeEach(async (): Promise<void> => {
    ctx = createContext(
      {
        headers: {
          accept: 'application/json'
        }
      },
      {}
    )

    ctx.container = deps
  })

  test('handles OpenPaymentsServerRouteError error', async (): Promise<void> => {
    const error = new OpenPaymentsServerRouteError(401, 'Some error')
    const next = jest.fn().mockImplementationOnce(() => {
      throw error
    })

    const ctxThrowSpy = jest.spyOn(ctx, 'throw')

    await expect(
      openPaymentServerErrorMiddleware(ctx, next)
    ).rejects.toMatchObject({
      status: error.status,
      message: error.message
    })

    expect(ctxThrowSpy).toHaveBeenCalledWith(error.status, error.message)
    expect(next).toHaveBeenCalledTimes(1)
  })

  test('handles OpenAPIValidatorMiddlewareError error', async (): Promise<void> => {
    const error = new OpenAPIValidatorMiddlewareError('Validation error', 400)
    const next = jest.fn().mockImplementationOnce(() => {
      throw error
    })

    const ctxThrowSpy = jest.spyOn(ctx, 'throw')

    await expect(
      openPaymentServerErrorMiddleware(ctx, next)
    ).rejects.toMatchObject({
      status: error.status,
      message: error.message
    })

    expect(ctxThrowSpy).toHaveBeenCalledWith(error.status, error.message)
    expect(next).toHaveBeenCalledTimes(1)
  })

  test('handles unspecified error', async (): Promise<void> => {
    const error = new Error('Some unspecified error')
    const next = jest.fn().mockImplementationOnce(() => {
      throw error
    })

    const ctxThrowSpy = jest.spyOn(ctx, 'throw')

    await expect(
      openPaymentServerErrorMiddleware(ctx, next)
    ).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error'
    })

    expect(ctxThrowSpy).toHaveBeenCalledWith(500)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
