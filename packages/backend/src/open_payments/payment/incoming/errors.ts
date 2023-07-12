export enum IncomingPaymentError {
  UnknownPaymentPointer = 'UnknownPaymentPointer',
  InvalidAmount = 'InvalidAmount',
  UnknownPayment = 'UnknownPayment',
  InvalidState = 'InvalidState',
  InvalidExpiry = 'InvalidExpiry',
  WrongState = 'WrongState',
  InactivePaymentPointer = 'InactivePaymentPointer'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const isIncomingPaymentError = (o: any): o is IncomingPaymentError =>
  Object.values(IncomingPaymentError).includes(o)

export const errorToCode: {
  [key in IncomingPaymentError]: number
} = {
  [IncomingPaymentError.UnknownPaymentPointer]: 404,
  [IncomingPaymentError.InvalidAmount]: 400,
  [IncomingPaymentError.UnknownPayment]: 404,
  [IncomingPaymentError.InvalidState]: 400,
  [IncomingPaymentError.InvalidExpiry]: 400,
  [IncomingPaymentError.WrongState]: 409,
  [IncomingPaymentError.InactivePaymentPointer]: 400
}

export const errorToMessage: {
  [key in IncomingPaymentError]: string
} = {
  [IncomingPaymentError.UnknownPaymentPointer]: 'unknown payment pointer',
  [IncomingPaymentError.InvalidAmount]: 'invalid amount',
  [IncomingPaymentError.UnknownPayment]: 'unknown payment',
  [IncomingPaymentError.InvalidState]: 'invalid state',
  [IncomingPaymentError.InvalidExpiry]: 'invalid expiresAt',
  [IncomingPaymentError.WrongState]: 'wrong state',
  [IncomingPaymentError.InactivePaymentPointer]: 'inactive payment pointer'
}
