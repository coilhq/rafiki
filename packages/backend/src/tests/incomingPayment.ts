import { IocContract } from '@adonisjs/fold'
import { LiquidityAccountType } from '../accounting/service'

import { AppServices } from '../app'
import { isIncomingPaymentError } from '../open_payments/payment/incoming/errors'
import { IncomingPayment } from '../open_payments/payment/incoming/model'
import { CreateIncomingPaymentOptions } from '../open_payments/payment/incoming/service'

export async function createIncomingPayment(
  deps: IocContract<AppServices>,
  options: CreateIncomingPaymentOptions
): Promise<IncomingPayment> {
  const config = await deps.use('config')
  const incomingPaymentService = await deps.use('incomingPaymentService')
  const incomingPaymentOrError = await incomingPaymentService.create({
    ...options,
    tenantId: options.tenantId ?? config.operatorTenantId
  })
  if (isIncomingPaymentError(incomingPaymentOrError)) {
    throw incomingPaymentOrError
  }

  const accountingService = await deps.use('accountingService')
  await accountingService.createLiquidityAccount(
    incomingPaymentOrError,
    LiquidityAccountType.INCOMING
  )
  return incomingPaymentOrError
}
