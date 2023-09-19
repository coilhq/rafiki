import { AssetService } from '../asset/service'
import { IAppConfig } from '../config/app'
import { isPeerError, PeerError } from '../peer/errors'
import { PeerService } from '../peer/service'
import { BaseService } from '../shared/baseService'
import { AutoPeeringError } from './errors'
import { v4 as uuid } from 'uuid'
import { Peer } from '../peer/model'

interface PeeringDetails {
  staticIlpAddress: string
  ilpConnectorAddress: string
  httpToken: string
  name: string
}

interface PeeringRequestArgs {
  staticIlpAddress: string
  ilpConnectorAddress: string
  asset: { code: string; scale: number }
  httpToken: string
  maxPacketAmount?: number
  name?: string
}

interface UpdatePeerArgs {
  staticIlpAddress: string
  ilpConnectorAddress: string
  assetId: string
  incomingHttpToken: string
  outgoingHttpToken: string
  maxPacketAmount?: number
  name?: string
}

export interface AutoPeeringService {
  acceptPeeringRequest(
    args: PeeringRequestArgs
  ): Promise<PeeringDetails | AutoPeeringError>
}

export interface ServiceDependencies extends BaseService {
  assetService: AssetService
  peerService: PeerService
  config: IAppConfig
}

export async function createAutoPeeringService(
  deps_: ServiceDependencies
): Promise<AutoPeeringService> {
  const deps: ServiceDependencies = {
    ...deps_,
    logger: deps_.logger.child({
      service: 'AutoPeeringService'
    })
  }

  return {
    acceptPeeringRequest: (args: PeeringRequestArgs) =>
      acceptPeeringRequest(deps, args)
  }
}

async function acceptPeeringRequest(
  deps: ServiceDependencies,
  args: PeeringRequestArgs
): Promise<PeeringDetails | AutoPeeringError> {
  const assets = await deps.assetService.getAll()

  const asset = assets.find(
    ({ code, scale }) => code === args.asset.code && scale === args.asset.scale
  )

  if (!asset) {
    return AutoPeeringError.UnknownAsset
  }

  const outgoingHttpToken = uuid()

  const createdPeerOrError = await deps.peerService.create({
    maxPacketAmount: args.maxPacketAmount
      ? BigInt(args.maxPacketAmount)
      : undefined,
    name: args.name,
    staticIlpAddress: args.staticIlpAddress,
    assetId: asset.id,
    http: {
      incoming: {
        authTokens: [args.httpToken]
      },
      outgoing: {
        endpoint: args.ilpConnectorAddress,
        authToken: outgoingHttpToken
      }
    }
  })

  const isDuplicatePeeringRequest =
    isPeerError(createdPeerOrError) &&
    createdPeerOrError === PeerError.DuplicatePeer

  const peerOrError = isDuplicatePeeringRequest
    ? await updatePeer(deps, {
        maxPacketAmount: args.maxPacketAmount,
        name: args.name,
        staticIlpAddress: args.staticIlpAddress,
        assetId: asset.id,
        outgoingHttpToken,
        incomingHttpToken: args.httpToken,
        ilpConnectorAddress: args.ilpConnectorAddress
      })
    : createdPeerOrError

  return peeringDetailsOrError(deps, peerOrError)
}

async function updatePeer(
  deps: ServiceDependencies,
  args: UpdatePeerArgs
): Promise<Peer | PeerError> {
  const peer = await deps.peerService.getByDestinationAddress(
    args.staticIlpAddress,
    args.assetId
  )

  if (!peer) {
    deps.logger.error({ request: args }, 'could not find peer by ILP address')
    return PeerError.UnknownPeer
  }

  return deps.peerService.update({
    id: peer.id,
    maxPacketAmount: args.maxPacketAmount
      ? BigInt(args.maxPacketAmount)
      : undefined,
    name: args.name,
    http: {
      incoming: { authTokens: [args.incomingHttpToken] },
      outgoing: {
        authToken: args.outgoingHttpToken,
        endpoint: args.ilpConnectorAddress
      }
    }
  })
}

async function peeringDetailsOrError(
  deps: ServiceDependencies,
  peerOrError: Peer | PeerError
): Promise<AutoPeeringError | PeeringDetails> {
  if (isPeerError(peerOrError)) {
    if (
      peerOrError === PeerError.InvalidHTTPEndpoint ||
      peerOrError === PeerError.InvalidStaticIlpAddress
    ) {
      return AutoPeeringError.InvalidPeerIlpConfiguration
    } else {
      deps.logger.error(
        { error: peerOrError },
        'Could not accept peering request'
      )
      return AutoPeeringError.InvalidPeeringRequest
    }
  }

  return {
    ilpConnectorAddress: deps.config.ilpConnectorAddress,
    staticIlpAddress: deps.config.ilpAddress,
    httpToken: peerOrError.http.outgoing.authToken,
    name: deps.config.instanceName
  }
}
