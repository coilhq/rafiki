import { Amount } from '../../open_payments/amount'
import { WalletAddress } from '../../open_payments/wallet_address/model'
import { Receiver } from '../../open_payments/receiver/model'
import { BaseService } from '../../shared/baseService'
import { IlpPaymentService } from '../ilp/service'

export interface StartQuoteOptions {
  walletAddress: WalletAddress
  debitAmount?: Amount
  receiveAmount?: Amount
  receiver: Receiver
}

export interface PaymentQuote {
  walletAddress: WalletAddress
  receiver: Receiver
  debitAmount: Amount
  receiveAmount: Amount
  estimatedExchangeRate: number
  additionalFields: Record<string, unknown>
}

export interface PaymentMethodService {
  getQuote(quoteOptions: StartQuoteOptions): Promise<PaymentQuote>
}

export type PaymentMethod = 'ILP'

export interface PaymentMethodHandlerService {
  getQuote(
    method: PaymentMethod,
    quoteOptions: StartQuoteOptions
  ): Promise<PaymentQuote>
}

interface ServiceDependencies extends BaseService {
  ilpPaymentService: IlpPaymentService
}

export async function createPaymentMethodHandlerService({
  logger,
  knex,
  ilpPaymentService
}: ServiceDependencies): Promise<PaymentMethodHandlerService> {
  const log = logger.child({
    service: 'PaymentMethodHandlerService'
  })
  const deps: ServiceDependencies = {
    logger: log,
    knex,
    ilpPaymentService
  }

  const paymentMethods: { [key in PaymentMethod]: PaymentMethodService } = {
    ILP: deps.ilpPaymentService
  }

  return {
    getQuote: (method, quoteOptions) =>
      paymentMethods[method].getQuote(quoteOptions)
  }
}
