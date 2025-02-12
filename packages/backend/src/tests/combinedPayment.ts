import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../app'
import {
  CombinedPayment,
  PaymentType
} from '../open_payments/payment/combined/model'
import { IncomingPayment } from '../open_payments/payment/incoming/model'
import { OutgoingPayment } from '../open_payments/payment/outgoing/model'
import { createIncomingPayment } from './incomingPayment'
import { createOutgoingPayment } from './outgoingPayment'
import { Config } from '../config/app'
import { v4 as uuid } from 'uuid'
import { createAsset } from './asset'
import { createWalletAddress } from './walletAddress'

export function toCombinedPayment(
  type: PaymentType,
  payment: IncomingPayment | OutgoingPayment
) {
  return CombinedPayment.fromJson({
    type,
    id: payment.id,
    walletAddressId: payment.walletAddressId,
    state: payment.state,
    metadata: payment.metadata,
    client: payment.client,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  })
}

/**
 * Creates a random payment (incoming or outgoing) and returns a combined payment object that represents it.
 * @param deps - the app service dependency container.
 * @returns A CombinedPayment object that represents the created payment.
 */
export async function createCombinedPayment(
  deps: IocContract<AppServices>
): Promise<CombinedPayment> {
  const sendAsset = await createAsset(deps)
  const receiveAsset = await createAsset(deps)
  const sendWalletAddressId = (
    await createWalletAddress(deps, {
      assetId: sendAsset.id,
      tenantId: sendAsset.tenantId
    })
  ).id
  const receiveWalletAddress = await createWalletAddress(deps, {
    assetId: receiveAsset.id,
    tenantId: sendAsset.tenantId
  })

  const type = Math.random() < 0.5 ? PaymentType.Incoming : PaymentType.Outgoing
  const payment =
    type === PaymentType.Incoming
      ? await createIncomingPayment(deps, {
          walletAddressId: receiveWalletAddress.id
        })
      : await createOutgoingPayment(deps, {
          tenantId: Config.operatorTenantId,
          walletAddressId: sendWalletAddressId,
          method: 'ilp',
          receiver: `${Config.openPaymentsUrl}/${uuid()}`,
          validDestination: false
        })
  return toCombinedPayment(type, payment)
}
