import {
  TransferError,
  errorToMessage as transferErrorToMessage,
  errorToCode as transferErrorToCode
} from '../../../accounting/errors'
import { GraphQLErrorCode } from '../../../graphql/errors'
import { PaymentMethodHandlerError } from '../../../payment-method/handler/errors'
import { QuoteError } from '../../quote/errors'

export enum OutgoingPaymentError {
  UnknownWalletAddress = 'UnknownWalletAddress',
  UnknownPayment = 'UnknownPayment',
  UnknownQuote = 'UnknownQuote',
  WrongState = 'WrongState',
  InvalidQuote = 'InvalidQuote',
  InsufficientGrant = 'InsufficientGrant',
  InactiveWalletAddress = 'InactiveWalletAddress',
  InvalidAmount = 'InvalidAmount',
  NegativeReceiveAmount = 'NegativeReceiveAmount',
  InvalidReceiver = 'InvalidReceiver'
}

export const quoteErrorToOutgoingPaymentError: Record<
  QuoteError,
  OutgoingPaymentError
> = {
  [QuoteError.UnknownWalletAddress]: OutgoingPaymentError.UnknownWalletAddress,
  [QuoteError.InvalidAmount]: OutgoingPaymentError.InvalidAmount,
  [QuoteError.InvalidReceiver]: OutgoingPaymentError.InvalidReceiver,
  [QuoteError.InactiveWalletAddress]:
    OutgoingPaymentError.InactiveWalletAddress,
  [QuoteError.NonPositiveReceiveAmount]:
    OutgoingPaymentError.NegativeReceiveAmount
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const isOutgoingPaymentError = (o: any): o is OutgoingPaymentError =>
  Object.values(OutgoingPaymentError).includes(o)

export const errorToHTTPCode: {
  [key in OutgoingPaymentError]: number
} = {
  [OutgoingPaymentError.UnknownWalletAddress]: 404,
  [OutgoingPaymentError.UnknownPayment]: 404,
  [OutgoingPaymentError.UnknownQuote]: 404,
  [OutgoingPaymentError.WrongState]: 409,
  [OutgoingPaymentError.InvalidQuote]: 400,
  [OutgoingPaymentError.InsufficientGrant]: 403,
  [OutgoingPaymentError.InactiveWalletAddress]: 400,
  [OutgoingPaymentError.InvalidAmount]: 400,
  [OutgoingPaymentError.NegativeReceiveAmount]: 400,
  [OutgoingPaymentError.InvalidReceiver]: 400
}

export const errorToCode: {
  [key in OutgoingPaymentError]: GraphQLErrorCode
} = {
  [OutgoingPaymentError.UnknownWalletAddress]: GraphQLErrorCode.NotFound,
  [OutgoingPaymentError.UnknownPayment]: GraphQLErrorCode.NotFound,
  [OutgoingPaymentError.UnknownQuote]: GraphQLErrorCode.NotFound,
  [OutgoingPaymentError.WrongState]: GraphQLErrorCode.Conflict,
  [OutgoingPaymentError.InvalidQuote]: GraphQLErrorCode.BadUserInput,
  [OutgoingPaymentError.InsufficientGrant]: GraphQLErrorCode.Forbidden,
  [OutgoingPaymentError.InactiveWalletAddress]: GraphQLErrorCode.Inactive,
  [OutgoingPaymentError.InvalidAmount]: GraphQLErrorCode.BadUserInput,
  [OutgoingPaymentError.NegativeReceiveAmount]: GraphQLErrorCode.BadUserInput,
  [OutgoingPaymentError.InvalidReceiver]: GraphQLErrorCode.BadUserInput
}

export const errorToMessage: {
  [key in OutgoingPaymentError]: string
} = {
  [OutgoingPaymentError.UnknownWalletAddress]: 'unknown wallet address',
  [OutgoingPaymentError.UnknownPayment]: 'unknown payment',
  [OutgoingPaymentError.UnknownQuote]: 'unknown quote',
  [OutgoingPaymentError.WrongState]: 'wrong state',
  [OutgoingPaymentError.InvalidQuote]: 'invalid quote',
  [OutgoingPaymentError.InsufficientGrant]: 'unauthorized',
  [OutgoingPaymentError.InactiveWalletAddress]: 'inactive wallet address',
  [OutgoingPaymentError.InvalidAmount]: 'invalid amount',
  [OutgoingPaymentError.NegativeReceiveAmount]: 'negative receive amount',
  [OutgoingPaymentError.InvalidReceiver]: 'invalid receiver'
}

export const FundingError = { ...OutgoingPaymentError, ...TransferError }
export type FundingError = OutgoingPaymentError | TransferError
export const fundingErrorToMessage = {
  ...errorToMessage,
  ...transferErrorToMessage
}
export const fundingErrorToCode = { ...errorToCode, ...transferErrorToCode }

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const isFundingError = (o: any): o is FundingError =>
  Object.values(FundingError).includes(o)

export type PaymentError = LifecycleError | PaymentMethodHandlerError

export enum LifecycleError {
  // Rate fetch failed.
  RatesUnavailable = 'RatesUnavailable',
  // Edge error due to retries, partial payment, and database write errors.
  BadState = 'BadState',
  // Account asset conflicts with debitAmount asset
  SourceAssetConflict = 'SourceAssetConflict',
  // Destination account asset conflicts with receiveAmount asset
  DestinationAssetConflict = 'DestinationAssetConflict',

  // These errors shouldn't ever trigger (impossible states), but they exist to satisfy types:
  MissingBalance = 'MissingBalance',
  MissingQuote = 'MissingQuote',
  MissingExpiration = 'MissingExpiration',
  Unauthorized = 'Unauthorized',

  // To be thrown when a Quote has expired
  QuoteExpired = 'QuoteExpired'
}
