import { IncomingPaymentWithPaymentMethods as OpenPaymentsIncomingPaymentWithPaymentMethods } from '@interledger/open-payments'
import { StreamCredentialsService } from '../../payment-method/ilp/stream-credentials/service'
import { WalletAddressService } from '../wallet_address/service'
import { BaseService } from '../../shared/baseService'
import { IncomingPaymentService } from '../payment/incoming/service'
import { WalletAddress } from '../wallet_address/model'
import { Receiver } from './model'
import { Amount } from '../amount'
import { RemoteIncomingPaymentService } from '../payment/incoming_remote/service'
import { isIncomingPaymentError } from '../payment/incoming/errors'
import {
  isReceiverError,
  ReceiverError,
  errorToMessage as receiverErrorToMessage
} from './errors'
import { isRemoteIncomingPaymentError } from '../payment/incoming_remote/errors'
import { TelemetryService } from '../../telemetry/service'

interface CreateReceiverArgs {
  walletAddressUrl: string
  expiresAt?: Date
  incomingAmount?: Amount
  metadata?: Record<string, unknown>
  tenantId: string
}

// A receiver is resolved from an incoming payment
export interface ReceiverService {
  get(url: string): Promise<Receiver | undefined>
  create(args: CreateReceiverArgs): Promise<Receiver | ReceiverError>
}

export interface ServiceDependencies extends BaseService {
  streamCredentialsService: StreamCredentialsService
  incomingPaymentService: IncomingPaymentService
  walletAddressService: WalletAddressService
  remoteIncomingPaymentService: RemoteIncomingPaymentService
  telemetry: TelemetryService
}

const INCOMING_PAYMENT_URL_REGEX =
  /(?<resourceServerUrl>^(.)+)\/incoming-payments\/(?<id>(.){36}$)/

export async function createReceiverService(
  deps_: ServiceDependencies
): Promise<ReceiverService> {
  const log = deps_.logger.child({
    service: 'ReceiverService'
  })
  const deps: ServiceDependencies = {
    ...deps_,
    logger: log
  }

  return {
    get: (url) => getReceiver(deps, url),
    create: (url) => createReceiver(deps, url)
  }
}

async function createReceiver(
  deps: ServiceDependencies,
  args: CreateReceiverArgs
): Promise<Receiver | ReceiverError> {
  const localWalletAddress = await deps.walletAddressService.getByUrl(
    args.walletAddressUrl
  )
  const isLocal = !!localWalletAddress

  const incomingPaymentOrError = isLocal
    ? await createLocalIncomingPayment(deps, args, localWalletAddress)
    : await deps.remoteIncomingPaymentService.create(args)

  if (isReceiverError(incomingPaymentOrError)) {
    return incomingPaymentOrError
  }

  try {
    return new Receiver(incomingPaymentOrError, isLocal)
  } catch (error) {
    const errorMessage = 'Could not create receiver from incoming payment'
    deps.logger.error(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Unknown error'
      },
      errorMessage
    )

    throw new Error(errorMessage, { cause: error })
  }
}

async function createLocalIncomingPayment(
  deps: ServiceDependencies,
  args: CreateReceiverArgs,
  walletAddress: WalletAddress
): Promise<OpenPaymentsIncomingPaymentWithPaymentMethods | ReceiverError> {
  const { expiresAt, incomingAmount, metadata, tenantId } = args

  const incomingPaymentOrError = await deps.incomingPaymentService.create({
    walletAddressId: walletAddress.id,
    expiresAt,
    incomingAmount,
    metadata,
    tenantId
  })

  if (isIncomingPaymentError(incomingPaymentOrError)) {
    const errorMessage = 'Could not create local incoming payment'
    deps.logger.error(
      { error: receiverErrorToMessage(incomingPaymentOrError) },
      errorMessage
    )

    return incomingPaymentOrError
  }

  const streamCredentials = deps.streamCredentialsService.get(
    incomingPaymentOrError
  )

  if (!streamCredentials) {
    const errorMessage =
      'Could not get stream credentials for local incoming payment'
    deps.logger.error({ err: incomingPaymentOrError }, errorMessage)

    throw new Error(errorMessage)
  }

  return incomingPaymentOrError.toOpenPaymentsTypeWithMethods(
    walletAddress,
    streamCredentials
  )
}

async function getReceiver(
  deps: ServiceDependencies,
  url: string
): Promise<Receiver | undefined> {
  const stopTimer = deps.telemetry.startTimer('getReceiver', {
    callName: 'ReceiverService:get'
  })
  try {
    const localIncomingPayment = await getLocalIncomingPayment(deps, url)
    if (localIncomingPayment) {
      const receiver = new Receiver(localIncomingPayment, true)
      return receiver
    }

    const remoteIncomingPayment = await getRemoteIncomingPayment(deps, url)
    if (remoteIncomingPayment) {
      const receiver = new Receiver(remoteIncomingPayment, false)
      return receiver
    }
  } catch (err) {
    deps.logger.error(
      { errorMessage: err instanceof Error && err.message },
      'Could not get incoming payment'
    )
  } finally {
    stopTimer()
  }
}

function parseIncomingPaymentUrl(
  url: string
): { id: string; resourceServerUrl: string } | undefined {
  const match = url.match(INCOMING_PAYMENT_URL_REGEX)?.groups
  if (!match || !match.resourceServerUrl || !match.id) {
    return undefined
  }

  return {
    id: match.id,
    resourceServerUrl: match.resourceServerUrl
  }
}

export async function getLocalIncomingPayment(
  deps: ServiceDependencies,
  url: string
): Promise<OpenPaymentsIncomingPaymentWithPaymentMethods | undefined> {
  const urlParseResult = parseIncomingPaymentUrl(url)
  if (!urlParseResult) {
    deps.logger.error({ url }, 'Could not parse incoming payment url')
    return undefined
  }

  const incomingPayment = await deps.incomingPaymentService.get({
    id: urlParseResult.id
  })

  if (!incomingPayment) {
    return undefined
  }

  if (!incomingPayment.walletAddress) {
    const errorMessage = 'Wallet address does not exist for incoming payment'
    deps.logger.error({ incomingPaymentId: incomingPayment.id }, errorMessage)

    throw new Error(errorMessage)
  }

  const streamCredentials = deps.streamCredentialsService.get(incomingPayment)

  if (!streamCredentials) {
    const errorMessage =
      'Could not get stream credentials for local incoming payment'
    deps.logger.error({ incomingPaymentId: incomingPayment.id }, errorMessage)

    throw new Error(errorMessage)
  }

  return incomingPayment.toOpenPaymentsTypeWithMethods(
    incomingPayment.walletAddress,
    streamCredentials
  )
}

async function getRemoteIncomingPayment(
  deps: ServiceDependencies,
  url: string
): Promise<OpenPaymentsIncomingPaymentWithPaymentMethods | undefined> {
  const incomingPaymentOrError =
    await deps.remoteIncomingPaymentService.get(url)

  if (isRemoteIncomingPaymentError(incomingPaymentOrError)) {
    return undefined
  }

  return incomingPaymentOrError
}
