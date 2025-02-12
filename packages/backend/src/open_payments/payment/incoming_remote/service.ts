import {
  AuthenticatedClient,
  IncomingPaymentWithPaymentMethods as OpenPaymentsIncomingPaymentWithPaymentMethods,
  AccessAction,
  WalletAddress as OpenPaymentsWalletAddress,
  AccessType,
  PublicIncomingPayment,
  OpenPaymentsClientError,
  WalletAddress
} from '@interledger/open-payments'
import { GrantService } from '../../grant/service'
import { BaseService } from '../../../shared/baseService'
import { Amount, serializeAmount } from '../../amount'
import { RemoteIncomingPaymentError } from './errors'
import { isGrantError } from '../../grant/errors'

interface CreateRemoteIncomingPaymentArgs {
  walletAddressUrl: string
  expiresAt?: Date
  incomingAmount?: Amount
  metadata?: Record<string, unknown>
}

export interface RemoteIncomingPaymentService {
  get(
    url: string
  ): Promise<
    OpenPaymentsIncomingPaymentWithPaymentMethods | RemoteIncomingPaymentError
  >
  create(
    args: CreateRemoteIncomingPaymentArgs
  ): Promise<
    OpenPaymentsIncomingPaymentWithPaymentMethods | RemoteIncomingPaymentError
  >
}

interface ServiceDependencies extends BaseService {
  grantService: GrantService
  openPaymentsUrl: string
  openPaymentsClient: AuthenticatedClient
}

export async function createRemoteIncomingPaymentService(
  deps_: ServiceDependencies
): Promise<RemoteIncomingPaymentService> {
  const log = deps_.logger.child({
    service: 'RemoteIncomingPaymentService'
  })
  const deps: ServiceDependencies = {
    ...deps_,
    logger: log
  }

  return {
    get: (url) => get(deps, url),
    create: (args) => create(deps, args)
  }
}

async function create(
  deps: ServiceDependencies,
  args: CreateRemoteIncomingPaymentArgs
): Promise<
  OpenPaymentsIncomingPaymentWithPaymentMethods | RemoteIncomingPaymentError
> {
  let walletAddress: OpenPaymentsWalletAddress

  try {
    walletAddress = await deps.openPaymentsClient.walletAddress.get({
      url: args.walletAddressUrl
    })
  } catch (err) {
    const errorMessage = 'Could not get wallet address'
    deps.logger.error(
      { err, walletAddressUrl: args.walletAddressUrl },
      errorMessage
    )
    return RemoteIncomingPaymentError.UnknownWalletAddress
  }

  return createIncomingPayment(deps, {
    createArgs: args,
    walletAddress
  })
}

async function createIncomingPayment(
  deps: ServiceDependencies,
  {
    createArgs,
    walletAddress,
    retryOnTokenError = true
  }: {
    createArgs: CreateRemoteIncomingPaymentArgs
    walletAddress: WalletAddress
    retryOnTokenError?: boolean
  }
): Promise<
  OpenPaymentsIncomingPaymentWithPaymentMethods | RemoteIncomingPaymentError
> {
  const resourceServerUrl =
    walletAddress.resourceServer ?? new URL(walletAddress.id).origin

  const grantOptions = {
    authServer: walletAddress.authServer,
    accessType: AccessType.IncomingPayment,
    accessActions: [AccessAction.Create, AccessAction.ReadAll]
  }

  const grant = await deps.grantService.getOrCreate(grantOptions)

  if (isGrantError(grant)) {
    return RemoteIncomingPaymentError.InvalidGrant
  }

  try {
    return await deps.openPaymentsClient.incomingPayment.create(
      {
        url: resourceServerUrl,
        accessToken: grant.accessToken
      },
      {
        walletAddress: walletAddress.id,
        incomingAmount: createArgs.incomingAmount
          ? serializeAmount(createArgs.incomingAmount)
          : undefined,
        expiresAt: createArgs.expiresAt?.toISOString(),
        metadata: createArgs.metadata ?? undefined
      }
    )
  } catch (err) {
    const errorMessage = 'Error creating remote incoming payment'

    const baseErrorLog = {
      walletAddressUrl: walletAddress.id,
      resourceServerUrl,
      grantId: grant.id
    }

    if (err instanceof OpenPaymentsClientError) {
      if ((err.status === 401 || err.status === 403) && retryOnTokenError) {
        deps.logger.warn(
          {
            ...baseErrorLog,
            errStatus: err.status,
            errCode: err.code,
            errDescription: err.description
          },
          `Retrying request after receiving ${err.status} error code when creating incoming payment`
        )

        await deps.grantService.delete(grant.id) // force new grant creation

        return createIncomingPayment(deps, {
          createArgs,
          walletAddress,
          retryOnTokenError: false
        })
      }

      deps.logger.error(
        {
          ...baseErrorLog,
          errStatus: err.status,
          errCode: err.code,
          errDescription: err.description,
          errMessage: err.message,
          errValidation: err.validationErrors
        },
        errorMessage
      )
    } else {
      deps.logger.error({ ...baseErrorLog, err }, errorMessage)
    }
    return RemoteIncomingPaymentError.InvalidRequest
  }
}

async function get(
  deps: ServiceDependencies,
  url: string
): Promise<
  OpenPaymentsIncomingPaymentWithPaymentMethods | RemoteIncomingPaymentError
> {
  let publicIncomingPayment: PublicIncomingPayment
  try {
    publicIncomingPayment =
      await deps.openPaymentsClient.incomingPayment.getPublic({
        url
      })
  } catch (err) {
    if (err instanceof OpenPaymentsClientError) {
      if (err.status === 404) {
        return RemoteIncomingPaymentError.NotFound
      }
    }

    deps.logger.warn({ url, err }, 'Could not get public incoming payment')
    return RemoteIncomingPaymentError.InvalidRequest
  }

  return getIncomingPayment(deps, {
    url,
    authServerUrl: publicIncomingPayment.authServer
  })
}

async function getIncomingPayment(
  deps: ServiceDependencies,
  {
    url,
    authServerUrl,
    retryOnTokenError = true
  }: { url: string; authServerUrl: string; retryOnTokenError?: boolean }
): Promise<
  OpenPaymentsIncomingPaymentWithPaymentMethods | RemoteIncomingPaymentError
> {
  const grantOptions = {
    authServer: authServerUrl,
    accessType: AccessType.IncomingPayment,
    accessActions: [AccessAction.ReadAll]
  }

  const grant = await deps.grantService.getOrCreate(grantOptions)

  if (isGrantError(grant)) {
    return RemoteIncomingPaymentError.InvalidGrant
  }

  try {
    const incomingPayment = await deps.openPaymentsClient.incomingPayment.get({
      url,
      accessToken: grant.accessToken
    })

    return incomingPayment
  } catch (err) {
    const errorMessage = 'Could not get remote incoming payment'

    const baseErrorLog = {
      incomingPaymentUrl: url,
      grantId: grant.id
    }

    if (err instanceof OpenPaymentsClientError) {
      if (err.status === 404) {
        return RemoteIncomingPaymentError.NotFound
      }

      if ((err.status === 403 || err.status === 401) && retryOnTokenError) {
        deps.logger.warn(
          {
            ...baseErrorLog,
            errStatus: err.status,
            errCode: err.code,
            errDescription: err.description
          },
          `Retrying request after receiving ${err.status} error code when getting incoming payment`
        )

        await deps.grantService.delete(grant.id) // force new grant creation

        return getIncomingPayment(deps, {
          url,
          authServerUrl,
          retryOnTokenError: false
        })
      }

      deps.logger.error(
        {
          ...baseErrorLog,
          errStatus: err.status,
          errCode: err.code,
          errDescription: err.description,
          errMessage: err.message,
          errValidation: err.validationErrors
        },
        errorMessage
      )
    } else {
      deps.logger.error({ ...baseErrorLog, err }, errorMessage)
    }

    return RemoteIncomingPaymentError.InvalidRequest
  }
}
