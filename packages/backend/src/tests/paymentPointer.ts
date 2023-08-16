import axios from 'axios'
import { IocContract } from '@adonisjs/fold'
import { faker } from '@faker-js/faker'
import nock from 'nock'
import { URL } from 'url'

import { testAccessToken } from './app'
import { createAsset } from './asset'
import { AppServices } from '../app'
import { isPaymentPointerError } from '../open_payments/payment_pointer/errors'
import { PaymentPointer } from '../open_payments/payment_pointer/model'
import { CreateOptions as BaseCreateOptions } from '../open_payments/payment_pointer/service'
import { LiquidityAccountType } from '../accounting/service'

interface CreateOptions extends Partial<BaseCreateOptions> {
  mockServerPort?: number
  createLiquidityAccount?: boolean
  deactivatedAt?: Date
}

export type MockPaymentPointer = PaymentPointer & {
  scope?: nock.Scope
}

export async function createPaymentPointer(
  deps: IocContract<AppServices>,
  options: Partial<CreateOptions> = {}
): Promise<MockPaymentPointer> {
  const paymentPointerService = await deps.use('paymentPointerService')
  const paymentPointerOrError = (await paymentPointerService.create({
    ...options,
    assetId: options.assetId || (await createAsset(deps)).id,
    url: options.url || `https://${faker.internet.domainName()}/.well-known/pay`
  })) as MockPaymentPointer
  if (isPaymentPointerError(paymentPointerOrError)) {
    throw new Error(paymentPointerOrError)
  }
  if (options.createLiquidityAccount) {
    const accountingService = await deps.use('accountingService')
    await accountingService.createLiquidityAccount(
      {
        id: paymentPointerOrError.id,
        asset: paymentPointerOrError.asset
      },
      LiquidityAccountType.WEB_MONETIZATION
    )
  }
  if (options.mockServerPort) {
    const url = new URL(paymentPointerOrError.url)
    paymentPointerOrError.scope = nock(url.origin)
      .get((uri) => uri.startsWith(url.pathname))
      .matchHeader('Accept', /application\/((ilp-stream|spsp4)\+)?json*./)
      .reply(200, function (path) {
        const headers = this.req.headers
        if (!headers['authorization']) {
          headers.authorization = `GNAP ${testAccessToken}`
        }
        return axios
          .get(`http://localhost:${options.mockServerPort}${path}`, {
            headers
          })
          .then((res) => res.data)
      })
      .persist()
  }
  return paymentPointerOrError
}
