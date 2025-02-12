import { IocContract } from '@adonisjs/fold'

import { AppServices } from '../app'
import { CreateIncomingPaymentOptions } from '../open_payments/payment/incoming/service'
import { WalletAddress } from '../open_payments/wallet_address/model'
import { Receiver } from '../open_payments/receiver/model'
import { createIncomingPayment } from './incomingPayment'

export async function createReceiver(
  deps: IocContract<AppServices>,
  walletAddress: WalletAddress,
  options?: Omit<CreateIncomingPaymentOptions, 'walletAddressId'>
): Promise<Receiver> {
  const config = await deps.use('config')
  const incomingPayment = await createIncomingPayment(deps, {
    ...options,
    walletAddressId: walletAddress.id,
    tenantId: options?.tenantId ?? config.operatorTenantId
  })

  const streamCredentialsService = await deps.use('streamCredentialsService')

  return new Receiver(
    incomingPayment.toOpenPaymentsTypeWithMethods(
      walletAddress,
      streamCredentialsService.get(incomingPayment)!
    ),
    false
  )
}
