import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** The `JSONObject` scalar type represents JSON objects as specified by the [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf) standard. */
  JSONObject: { input: any; output: any; }
  /** The `UInt8` scalar type represents unsigned 8-bit whole numeric values, ranging from 0 to 255. */
  UInt8: { input: number; output: number; }
  /** The `UInt64` scalar type represents unsigned 64-bit whole numeric values. It is capable of handling values that are larger than the JavaScript `Number` type limit (greater than 2^53). */
  UInt64: { input: bigint; output: bigint; }
};

export type AccountingTransfer = Model & {
  __typename?: 'AccountingTransfer';
  /** Amount sent (fixed send). */
  amount: Scalars['UInt64']['output'];
  /** The date and time that the accounting transfer was created. */
  createdAt: Scalars['String']['output'];
  /** Unique identifier for the credit account. */
  creditAccountId: Scalars['ID']['output'];
  /** Unique identifier for the debit account. */
  debitAccountId: Scalars['ID']['output'];
  /** The date and time that the accounting transfer will expire. */
  expiresAt?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the accounting transfer. */
  id: Scalars['ID']['output'];
  /** Identifier that partitions the sets of accounts that can transact with each other. */
  ledger: Scalars['UInt8']['output'];
  /** The state of the accounting transfer. */
  state: TransferState;
  /** Type of the accounting transfer. */
  transferType: TransferType;
};

export type AccountingTransferConnection = {
  __typename?: 'AccountingTransferConnection';
  credits: Array<AccountingTransfer>;
  debits: Array<AccountingTransfer>;
};

export type AdditionalProperty = {
  __typename?: 'AdditionalProperty';
  /** Key for the additional property. */
  key: Scalars['String']['output'];
  /** Value for the additional property. */
  value: Scalars['String']['output'];
  /** Indicates whether the property is visible in Open Payments wallet address requests. */
  visibleInOpenPayments: Scalars['Boolean']['output'];
};

export type AdditionalPropertyInput = {
  /** Key for the additional property. */
  key: Scalars['String']['input'];
  /** Value for the additional property. */
  value: Scalars['String']['input'];
  /** Indicates whether the property is visible in Open Payments wallet address requests. */
  visibleInOpenPayments: Scalars['Boolean']['input'];
};

export enum Alg {
  /** EdDSA cryptographic algorithm. */
  EdDsa = 'EdDSA'
}

export type Amount = {
  __typename?: 'Amount';
  /** Should be an ISO 4217 currency code whenever possible, e.g. `USD`. For more information, refer to [assets](https://rafiki.dev/overview/concepts/accounting/#assets). */
  assetCode: Scalars['String']['output'];
  /** Difference in order of magnitude between the standard unit of an asset and its corresponding fractional unit. */
  assetScale: Scalars['UInt8']['output'];
  /** Numerical value. */
  value: Scalars['UInt64']['output'];
};

export type AmountInput = {
  /** Should be an ISO 4217 currency code whenever possible, e.g. `USD`. For more information, refer to [assets](https://rafiki.dev/overview/concepts/accounting/#assets). */
  assetCode: Scalars['String']['input'];
  /** Difference in order of magnitude between the standard unit of an asset and its corresponding fractional unit. */
  assetScale: Scalars['UInt8']['input'];
  /** Numerical value. */
  value: Scalars['UInt64']['input'];
};

export type ApproveIncomingPaymentInput = {
  /** Unique identifier of the incoming payment to be approved. Note: incoming payment must be PENDING. */
  id: Scalars['ID']['input'];
};

export type ApproveIncomingPaymentResponse = {
  __typename?: 'ApproveIncomingPaymentResponse';
  /** The incoming payment that was approved. */
  payment?: Maybe<IncomingPayment>;
};

export type Asset = Model & {
  __typename?: 'Asset';
  /** Should be an ISO 4217 currency code whenever possible, e.g. `USD`. For more information, refer to [assets](https://rafiki.dev/overview/concepts/accounting/#assets). */
  code: Scalars['String']['output'];
  /** The date and time when the asset was created. */
  createdAt: Scalars['String']['output'];
  /** Fetches a paginated list of fees associated with this asset. */
  fees?: Maybe<FeesConnection>;
  /** Unique identifier of the asset. */
  id: Scalars['ID']['output'];
  /** Available liquidity */
  liquidity?: Maybe<Scalars['UInt64']['output']>;
  /** A webhook event will notify the Account Servicing Entity if liquidity falls below this value. */
  liquidityThreshold?: Maybe<Scalars['UInt64']['output']>;
  /** The receiving fee structure for the asset. */
  receivingFee?: Maybe<Fee>;
  /** Difference in order of magnitude between the standard unit of an asset and its corresponding fractional unit. */
  scale: Scalars['UInt8']['output'];
  /** The sending fee structure for the asset. */
  sendingFee?: Maybe<Fee>;
  /** Minimum amount of liquidity that can be withdrawn from the asset. */
  withdrawalThreshold?: Maybe<Scalars['UInt64']['output']>;
};


export type AssetFeesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};

export type AssetEdge = {
  __typename?: 'AssetEdge';
  /** A cursor for paginating through the assets. */
  cursor: Scalars['String']['output'];
  /** An asset node in the list. */
  node: Asset;
};

export type AssetMutationResponse = {
  __typename?: 'AssetMutationResponse';
  /** The asset affected by the mutation. */
  asset?: Maybe<Asset>;
};

export type AssetsConnection = {
  __typename?: 'AssetsConnection';
  /** A list of edges representing assets and cursors for pagination. */
  edges: Array<AssetEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
};

export type BasePayment = {
  /** Information about the wallet address of the Open Payments client that created the payment. */
  client?: Maybe<Scalars['String']['output']>;
  /** The date and time that the payment was created. */
  createdAt: Scalars['String']['output'];
  /** Unique identifier for the payment. */
  id: Scalars['ID']['output'];
  /** Additional metadata associated with the payment. */
  metadata?: Maybe<Scalars['JSONObject']['output']>;
  /** Unique identifier of the wallet address under which the payment was created. */
  walletAddressId: Scalars['ID']['output'];
};

export type CancelIncomingPaymentInput = {
  /** Unique identifier of the incoming payment to be canceled. Note: incoming payment must be PENDING. */
  id: Scalars['ID']['input'];
};

export type CancelIncomingPaymentResponse = {
  __typename?: 'CancelIncomingPaymentResponse';
  /** The incoming payment that was canceled. */
  payment?: Maybe<IncomingPayment>;
};

export type CancelOutgoingPaymentInput = {
  /** Unique identifier of the outgoing payment to cancel. */
  id: Scalars['ID']['input'];
  /** Reason why this outgoing payment has been canceled. This value will be publicly visible in the metadata field if this outgoing payment is requested through Open Payments. */
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type CreateAssetInput = {
  /** Should be an ISO 4217 currency code whenever possible, e.g. `USD`. For more information, refer to [assets](https://rafiki.dev/overview/concepts/accounting/#assets). */
  code: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** A webhook event will notify the Account Servicing Entity if liquidity falls below this value. */
  liquidityThreshold?: InputMaybe<Scalars['UInt64']['input']>;
  /** Difference in order of magnitude between the standard unit of an asset and its corresponding fractional unit. */
  scale: Scalars['UInt8']['input'];
  /** Minimum amount of liquidity that can be withdrawn from the asset. */
  withdrawalThreshold?: InputMaybe<Scalars['UInt64']['input']>;
};

export type CreateAssetLiquidityWithdrawalInput = {
  /** Amount of liquidity to withdraw. */
  amount: Scalars['UInt64']['input'];
  /** Unique identifier of the asset to create the withdrawal for. */
  assetId: Scalars['String']['input'];
  /** Unique identifier of the withdrawal. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Interval in seconds after a pending transfer's created at which it may be posted or voided. Zero denotes a no timeout single-phase posted transfer. */
  timeoutSeconds: Scalars['UInt64']['input'];
};

export type CreateIncomingPaymentInput = {
  /** Date and time that the incoming payment will expire. */
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Maximum amount to be received for this incoming payment. */
  incomingAmount?: InputMaybe<AmountInput>;
  /** Additional metadata associated with the incoming payment. */
  metadata?: InputMaybe<Scalars['JSONObject']['input']>;
  /** Unique identifier of the wallet address under which the incoming payment will be created. */
  walletAddressId: Scalars['String']['input'];
};

export type CreateIncomingPaymentWithdrawalInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the incoming payment to withdraw liquidity from. */
  incomingPaymentId: Scalars['String']['input'];
  /** Interval in seconds after a pending transfer's created at which it may be posted or voided. Zero denotes a no timeout single-phase posted transfer. */
  timeoutSeconds: Scalars['UInt64']['input'];
};

export type CreateOrUpdatePeerByUrlInput = {
  /** Unique identifier of the asset associated with the peering relationship. */
  assetId: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** A webhook event will notify the Account Servicing Entity if peer liquidity falls below this value. */
  liquidityThreshold?: InputMaybe<Scalars['UInt64']['input']>;
  /** Amount of liquidity to deposit for the peer. */
  liquidityToDeposit?: InputMaybe<Scalars['UInt64']['input']>;
  /** Maximum packet amount that the peer accepts. */
  maxPacketAmount?: InputMaybe<Scalars['UInt64']['input']>;
  /** Internal name for the peer, used to override auto-peering default names. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Peer's URL address, where auto-peering requests are accepted. */
  peerUrl: Scalars['String']['input'];
};

export type CreateOrUpdatePeerByUrlMutationResponse = {
  __typename?: 'CreateOrUpdatePeerByUrlMutationResponse';
  /** The peer created or updated based on a URL. */
  peer?: Maybe<Peer>;
};

export type CreateOutgoingPaymentFromIncomingPaymentInput = {
  /** Amount to send (fixed send). */
  debitAmount: AmountInput;
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Incoming payment URL to create the outgoing payment from. */
  incomingPayment: Scalars['String']['input'];
  /** Additional metadata associated with the outgoing payment. */
  metadata?: InputMaybe<Scalars['JSONObject']['input']>;
  /** Unique identifier of the wallet address under which the outgoing payment will be created. */
  walletAddressId: Scalars['String']['input'];
};

export type CreateOutgoingPaymentInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Additional metadata associated with the outgoing payment. */
  metadata?: InputMaybe<Scalars['JSONObject']['input']>;
  /** Unique identifier of the corresponding quote for that outgoing payment. */
  quoteId: Scalars['String']['input'];
  /** Unique identifier of the wallet address under which the outgoing payment will be created. */
  walletAddressId: Scalars['String']['input'];
};

export type CreateOutgoingPaymentWithdrawalInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the outgoing payment to withdraw liquidity from. */
  outgoingPaymentId: Scalars['String']['input'];
  /** Interval in seconds after a pending transfer's created at which it may be posted or voided. Zero denotes a no timeout single-phase posted transfer. */
  timeoutSeconds: Scalars['UInt64']['input'];
};

export type CreatePeerInput = {
  /** Unique identifier of the asset associated with the peering relationship. */
  assetId: Scalars['String']['input'];
  /** Peering connection details. */
  http: HttpInput;
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Initial amount of liquidity to deposit for the peer. */
  initialLiquidity?: InputMaybe<Scalars['UInt64']['input']>;
  /** A webhook event will notify the Account Servicing Entity if peer liquidity falls below this value. */
  liquidityThreshold?: InputMaybe<Scalars['UInt64']['input']>;
  /** Maximum packet amount that the peer accepts. */
  maxPacketAmount?: InputMaybe<Scalars['UInt64']['input']>;
  /** Internal name of the peer. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** ILP address of the peer. */
  staticIlpAddress: Scalars['String']['input'];
};

export type CreatePeerLiquidityWithdrawalInput = {
  /** Amount of liquidity to withdraw. */
  amount: Scalars['UInt64']['input'];
  /** Unique identifier of the withdrawal. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the peer to create the withdrawal for. */
  peerId: Scalars['String']['input'];
  /** Interval in seconds after a pending transfer's created at which it may be posted or voided. Zero denotes a no timeout single-phase posted transfer. */
  timeoutSeconds: Scalars['UInt64']['input'];
};

export type CreatePeerMutationResponse = {
  __typename?: 'CreatePeerMutationResponse';
  /** The peer created by the mutation. */
  peer?: Maybe<Peer>;
};

export type CreateQuoteInput = {
  /** Amount to send (fixed send). */
  debitAmount?: InputMaybe<AmountInput>;
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Amount to receive (fixed receive). */
  receiveAmount?: InputMaybe<AmountInput>;
  /** Wallet address URL of the receiver. */
  receiver: Scalars['String']['input'];
  /** Unique identifier of the wallet address under which the quote will be created. */
  walletAddressId: Scalars['String']['input'];
};

export type CreateReceiverInput = {
  /** Date and time that the incoming payment expires for the receiver. */
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Maximum amount to be received for this incoming payment. */
  incomingAmount?: InputMaybe<AmountInput>;
  /** Additional metadata associated with the incoming payment. */
  metadata?: InputMaybe<Scalars['JSONObject']['input']>;
  /** Receiving wallet address URL. */
  walletAddressUrl: Scalars['String']['input'];
};

export type CreateReceiverResponse = {
  __typename?: 'CreateReceiverResponse';
  /** The receiver object returned in the response. */
  receiver?: Maybe<Receiver>;
};

export type CreateTenantInput = {
  /** Secret used to secure requests made for this tenant. */
  apiSecret: Scalars['String']['input'];
  /** Contact email of the tenant owner. */
  email?: InputMaybe<Scalars['String']['input']>;
  /** URL of the tenant's identity provider's consent screen. */
  idpConsentUrl?: InputMaybe<Scalars['String']['input']>;
  /** Secret used to secure requests from the tenant's identity provider. */
  idpSecret?: InputMaybe<Scalars['String']['input']>;
  /** Public name for the tenant. */
  publicName?: InputMaybe<Scalars['String']['input']>;
};

export type CreateWalletAddressInput = {
  /** Additional properties associated with the wallet address. */
  additionalProperties?: InputMaybe<Array<AdditionalPropertyInput>>;
  /** Unique identifier of the asset associated with the wallet address. This cannot be changed. */
  assetId: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Public name associated with the wallet address. This is visible to anyone with the wallet address URL. */
  publicName?: InputMaybe<Scalars['String']['input']>;
  /** Unique identifier of the tenant associated with the wallet address. This cannot be changed. Optional, if not provided, the tenantId will be obtained from the signature. */
  tenantId?: InputMaybe<Scalars['ID']['input']>;
  /** Wallet address URL. This cannot be changed. */
  url: Scalars['String']['input'];
};

export type CreateWalletAddressKeyInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Public key in JSON Web Key (JWK) format. */
  jwk: JwkInput;
  /** Unique identifier of the wallet address to associate with the key. */
  walletAddressId: Scalars['String']['input'];
};

export type CreateWalletAddressKeyMutationResponse = {
  __typename?: 'CreateWalletAddressKeyMutationResponse';
  /** The wallet address key that was created. */
  walletAddressKey?: Maybe<WalletAddressKey>;
};

export type CreateWalletAddressMutationResponse = {
  __typename?: 'CreateWalletAddressMutationResponse';
  /** The newly created wallet address. */
  walletAddress?: Maybe<WalletAddress>;
};

export type CreateWalletAddressWithdrawalInput = {
  /** Unique identifier of the withdrawal. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Interval in seconds after a pending transfer's created at which it may be posted or voided. Zero denotes a no timeout single-phase posted transfer. */
  timeoutSeconds: Scalars['UInt64']['input'];
  /** Unique identifier of the Open Payments wallet address to create the withdrawal for. */
  walletAddressId: Scalars['String']['input'];
};

export enum Crv {
  /** Elliptic curve `Ed25519`, used in EdDSA. */
  Ed25519 = 'Ed25519'
}

export type DeleteAssetInput = {
  /** Unique identifier of the asset to delete. */
  id: Scalars['ID']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
};

export type DeleteAssetMutationResponse = {
  __typename?: 'DeleteAssetMutationResponse';
  /** The asset that was deleted. */
  asset?: Maybe<Asset>;
};

export type DeletePeerInput = {
  /** Unique identifier of the peer to be deleted. */
  id: Scalars['ID']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
};

export type DeletePeerMutationResponse = {
  __typename?: 'DeletePeerMutationResponse';
  /** Indicates whether the peer deletion was successful. */
  success: Scalars['Boolean']['output'];
};

export type DeleteTenantMutationResponse = {
  __typename?: 'DeleteTenantMutationResponse';
  success: Scalars['Boolean']['output'];
};

export type DepositAssetLiquidityInput = {
  /** Amount of liquidity to deposit. */
  amount: Scalars['UInt64']['input'];
  /** Unique identifier of the asset to deposit liquidity into. */
  assetId: Scalars['String']['input'];
  /** Unique identifier of the liquidity transfer. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
};

export type DepositEventLiquidityInput = {
  /** Unique identifier of the event to deposit liquidity into. */
  eventId: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
};

export type DepositOutgoingPaymentLiquidityInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the outgoing payment to deposit liquidity into. */
  outgoingPaymentId: Scalars['String']['input'];
};

export type DepositPeerLiquidityInput = {
  /** Amount of liquidity to deposit. */
  amount: Scalars['UInt64']['input'];
  /** Unique identifier of the liquidity transfer. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the peer to deposit liquidity into. */
  peerId: Scalars['String']['input'];
};

export type Fee = Model & {
  __typename?: 'Fee';
  /** Unique identifier of the asset associated with the fee. */
  assetId: Scalars['ID']['output'];
  /** Basis points fee is a variable fee charged based on the total amount. Should be between 0 and 10000 (inclusive). 1 basis point = 0.01%, 100 basis points = 1%, 10000 basis points = 100%. */
  basisPoints: Scalars['Int']['output'];
  /** The date and time that this fee was created. */
  createdAt: Scalars['String']['output'];
  /** Amount of the flat, fixed fee to charge. */
  fixed: Scalars['UInt64']['output'];
  /** Unique identifier of the fee. */
  id: Scalars['ID']['output'];
  /** Type of fee, either sending or receiving. */
  type: FeeType;
};

export type FeeDetails = {
  /** Basis points fee is a variable fee charged based on the total amount. Should be between 0 and 10000 (inclusive). 1 basis point = 0.01%, 100 basis points = 1%, 10000 basis points = 100%. */
  basisPoints: Scalars['Int']['input'];
  /** Amount of the flat, fixed fee to charge. */
  fixed: Scalars['UInt64']['input'];
};

export type FeeEdge = {
  __typename?: 'FeeEdge';
  /** A cursor for paginating through the fees. */
  cursor: Scalars['String']['output'];
  /** A fee node in the list. */
  node: Fee;
};

export enum FeeType {
  /** The receiver is responsible for paying the fees. */
  Receiving = 'RECEIVING',
  /** The sender is responsible for paying the fees. */
  Sending = 'SENDING'
}

export type FeesConnection = {
  __typename?: 'FeesConnection';
  /** A list of fee edges, containing fee nodes and cursors for pagination. */
  edges: Array<FeeEdge>;
  /** Pagination information for fees. */
  pageInfo: PageInfo;
};

export type FilterString = {
  /** Array of strings to filter by. */
  in: Array<Scalars['String']['input']>;
};

export type Http = {
  __typename?: 'Http';
  /** Details of the outgoing connection for peering. */
  outgoing: HttpOutgoing;
};

export type HttpIncomingInput = {
  /** Array of authorization tokens accepted by this Rafiki instance. */
  authTokens: Array<Scalars['String']['input']>;
};

export type HttpInput = {
  /** Incoming connection details. */
  incoming?: InputMaybe<HttpIncomingInput>;
  /** Outgoing connection details. */
  outgoing: HttpOutgoingInput;
};

export type HttpOutgoing = {
  __typename?: 'HttpOutgoing';
  /** Authorization token to be presented to the peer's Rafiki instance. */
  authToken: Scalars['String']['output'];
  /** Connection endpoint of the peer. */
  endpoint: Scalars['String']['output'];
};

export type HttpOutgoingInput = {
  /** Authorization token to present at the peer's Rafiki instance. */
  authToken: Scalars['String']['input'];
  /** Connection endpoint of the peer. */
  endpoint: Scalars['String']['input'];
};

export type IncomingPayment = BasePayment & Model & {
  __typename?: 'IncomingPayment';
  /** Information about the wallet address of the Open Payments client that created the incoming payment. */
  client?: Maybe<Scalars['String']['output']>;
  /** The date and time that the incoming payment was created. */
  createdAt: Scalars['String']['output'];
  /** Date and time that the incoming payment will expire. After this time, the incoming payment will not accept further payments made to it. */
  expiresAt: Scalars['String']['output'];
  /** Unique identifier of the incoming payment. */
  id: Scalars['ID']['output'];
  /** The maximum amount that should be paid into the wallet address under this incoming payment. */
  incomingAmount?: Maybe<Amount>;
  /** Current amount of liquidity available for this incoming payment. */
  liquidity?: Maybe<Scalars['UInt64']['output']>;
  /** Additional metadata associated with the incoming payment. */
  metadata?: Maybe<Scalars['JSONObject']['output']>;
  /** The total amount that has been paid into the wallet address under this incoming payment. */
  receivedAmount: Amount;
  /** State of the incoming payment. */
  state: IncomingPaymentState;
  /** Unique identifier of the wallet address under which the incoming payment was created. */
  walletAddressId: Scalars['ID']['output'];
};

export type IncomingPaymentConnection = {
  __typename?: 'IncomingPaymentConnection';
  /** A list of incoming payment edges, containing incoming payment nodes and cursors for pagination. */
  edges: Array<IncomingPaymentEdge>;
  /** Pagination information for the incoming payments. */
  pageInfo: PageInfo;
};

export type IncomingPaymentEdge = {
  __typename?: 'IncomingPaymentEdge';
  /** A cursor for paginating through the incoming payments. */
  cursor: Scalars['String']['output'];
  /** An incoming payment node in the list. */
  node: IncomingPayment;
};

export type IncomingPaymentResponse = {
  __typename?: 'IncomingPaymentResponse';
  /** The incoming payment object returned in the response. */
  payment?: Maybe<IncomingPayment>;
};

export enum IncomingPaymentState {
  /** The payment is completed automatically once the expected `incomingAmount` is received or manually via an API call. */
  Completed = 'COMPLETED',
  /** The payment has expired before completion, and no further funds will be accepted. */
  Expired = 'EXPIRED',
  /** The payment is pending when it is initially created and has not started processing. */
  Pending = 'PENDING',
  /** The payment is being processed after funds have started clearing into the account. */
  Processing = 'PROCESSING'
}

export type Jwk = {
  __typename?: 'Jwk';
  /** Cryptographic algorithm used with the key. The only allowed value is `EdDSA`. */
  alg: Alg;
  /** Cryptographic curve that the key pair is derived from. The only allowed value is `Ed25519`. */
  crv: Crv;
  /** Unique identifier for the key. */
  kid: Scalars['String']['output'];
  /** Key type. The only allowed value is `OKP`. */
  kty: Kty;
  /** Base64 url-encoded public key. */
  x: Scalars['String']['output'];
};

export type JwkInput = {
  /** Cryptographic algorithm used with the key. The only allowed value is `EdDSA`. */
  alg: Alg;
  /** Cryptographic curve that the key pair is derived from. The only allowed value is `Ed25519`. */
  crv: Crv;
  /** Unique identifier for the key. */
  kid: Scalars['String']['input'];
  /** Key type. The only allowed value is `OKP`. */
  kty: Kty;
  /** Base64 url-encoded public key. */
  x: Scalars['String']['input'];
};

export enum Kty {
  /** Octet Key Pair (OKP) key type. */
  Okp = 'OKP'
}

export enum LiquidityError {
  /** The transfer has already been posted. */
  AlreadyPosted = 'AlreadyPosted',
  /** The transfer has already been voided. */
  AlreadyVoided = 'AlreadyVoided',
  /** The amount specified for the transfer is zero. */
  AmountZero = 'AmountZero',
  /** Insufficient balance to complete the transfer. */
  InsufficientBalance = 'InsufficientBalance',
  /** The provided ID for the transfer is invalid. */
  InvalidId = 'InvalidId',
  /** A transfer with the same ID already exists. */
  TransferExists = 'TransferExists',
  /** The specified asset could not be found. */
  UnknownAsset = 'UnknownAsset',
  /** The specified incoming payment could not be found. */
  UnknownIncomingPayment = 'UnknownIncomingPayment',
  /** The specified payment could not be found. */
  UnknownPayment = 'UnknownPayment',
  /** The specified peer could not be found. */
  UnknownPeer = 'UnknownPeer',
  /** The specified transfer could not be found. */
  UnknownTransfer = 'UnknownTransfer',
  /** The specified wallet address could not be found. */
  UnknownWalletAddress = 'UnknownWalletAddress'
}

export type LiquidityMutationResponse = {
  __typename?: 'LiquidityMutationResponse';
  /** Indicates whether the liquidity operation was successful. */
  success: Scalars['Boolean']['output'];
};

export type Model = {
  /** The date and time that the entity was created. */
  createdAt: Scalars['String']['output'];
  /** Unique identifier for the entity. */
  id: Scalars['ID']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Approves the incoming payment if the incoming payment is in the PENDING state */
  approveIncomingPayment: ApproveIncomingPaymentResponse;
  /** Cancel the incoming payment if the incoming payment is in the PENDING state */
  cancelIncomingPayment: CancelIncomingPaymentResponse;
  /** Cancel an outgoing payment. */
  cancelOutgoingPayment: OutgoingPaymentResponse;
  /** Create a new asset. */
  createAsset: AssetMutationResponse;
  /** Withdraw asset liquidity. */
  createAssetLiquidityWithdrawal?: Maybe<LiquidityMutationResponse>;
  /** Create an internal Open Payments incoming payment. The receiver has a wallet address on this Rafiki instance. */
  createIncomingPayment: IncomingPaymentResponse;
  /** Withdraw incoming payment liquidity. */
  createIncomingPaymentWithdrawal?: Maybe<LiquidityMutationResponse>;
  /** Create or update a peer using a URL. */
  createOrUpdatePeerByUrl: CreateOrUpdatePeerByUrlMutationResponse;
  /** Create an Open Payments outgoing payment. */
  createOutgoingPayment: OutgoingPaymentResponse;
  /** Create an Open Payments outgoing payment from an incoming payment. */
  createOutgoingPaymentFromIncomingPayment: OutgoingPaymentResponse;
  /** Withdraw outgoing payment liquidity. */
  createOutgoingPaymentWithdrawal?: Maybe<LiquidityMutationResponse>;
  /** Create a new peer. */
  createPeer: CreatePeerMutationResponse;
  /** Withdraw peer liquidity. */
  createPeerLiquidityWithdrawal?: Maybe<LiquidityMutationResponse>;
  /** Create an Open Payments quote. */
  createQuote: QuoteResponse;
  /** Create an internal or external Open Payments incoming payment. The receiver has a wallet address on either this or another Open Payments resource server. */
  createReceiver: CreateReceiverResponse;
  /** As an operator, create a tenant. */
  createTenant: TenantMutationResponse;
  /** Create a new wallet address. */
  createWalletAddress: CreateWalletAddressMutationResponse;
  /** Add a public key to a wallet address that is used to verify Open Payments requests. */
  createWalletAddressKey?: Maybe<CreateWalletAddressKeyMutationResponse>;
  /** Withdraw liquidity from a wallet address received via Web Monetization. */
  createWalletAddressWithdrawal?: Maybe<WalletAddressWithdrawalMutationResponse>;
  /** Delete an asset. */
  deleteAsset: DeleteAssetMutationResponse;
  /** Delete a peer. */
  deletePeer: DeletePeerMutationResponse;
  /** Delete a tenant. */
  deleteTenant: DeleteTenantMutationResponse;
  /** Deposit asset liquidity. */
  depositAssetLiquidity?: Maybe<LiquidityMutationResponse>;
  /**
   * Deposit webhook event liquidity (deprecated).
   * @deprecated Use `depositOutgoingPaymentLiquidity`
   */
  depositEventLiquidity?: Maybe<LiquidityMutationResponse>;
  /** Deposit outgoing payment liquidity. */
  depositOutgoingPaymentLiquidity?: Maybe<LiquidityMutationResponse>;
  /** Deposit peer liquidity. */
  depositPeerLiquidity?: Maybe<LiquidityMutationResponse>;
  /** Post liquidity withdrawal. Withdrawals are two-phase commits and are committed via this mutation. */
  postLiquidityWithdrawal?: Maybe<LiquidityMutationResponse>;
  /** Revoke a public key associated with a wallet address. Open Payment requests using this key for request signatures will be denied going forward. */
  revokeWalletAddressKey?: Maybe<RevokeWalletAddressKeyMutationResponse>;
  /** Set the fee structure on an asset. */
  setFee: SetFeeResponse;
  /** If automatic withdrawal of funds received via Web Monetization by the wallet address are disabled, this mutation can be used to trigger up to **n** withdrawal events. */
  triggerWalletAddressEvents: TriggerWalletAddressEventsMutationResponse;
  /** Update an existing asset. */
  updateAsset: AssetMutationResponse;
  /** Update an existing incoming payment. */
  updateIncomingPayment: IncomingPaymentResponse;
  /** Update an existing peer. */
  updatePeer: UpdatePeerMutationResponse;
  /** Update a tenant. */
  updateTenant: TenantMutationResponse;
  /** Update an existing wallet address. */
  updateWalletAddress: UpdateWalletAddressMutationResponse;
  /** Void liquidity withdrawal. Withdrawals are two-phase commits and are rolled back via this mutation. */
  voidLiquidityWithdrawal?: Maybe<LiquidityMutationResponse>;
  /**
   * Withdraw webhook event liquidity (deprecated).
   * @deprecated Use `createOutgoingPaymentWithdrawal, createIncomingPaymentWithdrawal, or createWalletAddressWithdrawal`
   */
  withdrawEventLiquidity?: Maybe<LiquidityMutationResponse>;
};


export type MutationApproveIncomingPaymentArgs = {
  input: ApproveIncomingPaymentInput;
};


export type MutationCancelIncomingPaymentArgs = {
  input: CancelIncomingPaymentInput;
};


export type MutationCancelOutgoingPaymentArgs = {
  input: CancelOutgoingPaymentInput;
};


export type MutationCreateAssetArgs = {
  input: CreateAssetInput;
};


export type MutationCreateAssetLiquidityWithdrawalArgs = {
  input: CreateAssetLiquidityWithdrawalInput;
};


export type MutationCreateIncomingPaymentArgs = {
  input: CreateIncomingPaymentInput;
};


export type MutationCreateIncomingPaymentWithdrawalArgs = {
  input: CreateIncomingPaymentWithdrawalInput;
};


export type MutationCreateOrUpdatePeerByUrlArgs = {
  input: CreateOrUpdatePeerByUrlInput;
};


export type MutationCreateOutgoingPaymentArgs = {
  input: CreateOutgoingPaymentInput;
};


export type MutationCreateOutgoingPaymentFromIncomingPaymentArgs = {
  input: CreateOutgoingPaymentFromIncomingPaymentInput;
};


export type MutationCreateOutgoingPaymentWithdrawalArgs = {
  input: CreateOutgoingPaymentWithdrawalInput;
};


export type MutationCreatePeerArgs = {
  input: CreatePeerInput;
};


export type MutationCreatePeerLiquidityWithdrawalArgs = {
  input: CreatePeerLiquidityWithdrawalInput;
};


export type MutationCreateQuoteArgs = {
  input: CreateQuoteInput;
};


export type MutationCreateReceiverArgs = {
  input: CreateReceiverInput;
};


export type MutationCreateTenantArgs = {
  input: CreateTenantInput;
};


export type MutationCreateWalletAddressArgs = {
  input: CreateWalletAddressInput;
};


export type MutationCreateWalletAddressKeyArgs = {
  input: CreateWalletAddressKeyInput;
};


export type MutationCreateWalletAddressWithdrawalArgs = {
  input: CreateWalletAddressWithdrawalInput;
};


export type MutationDeleteAssetArgs = {
  input: DeleteAssetInput;
};


export type MutationDeletePeerArgs = {
  input: DeletePeerInput;
};


export type MutationDeleteTenantArgs = {
  id: Scalars['String']['input'];
};


export type MutationDepositAssetLiquidityArgs = {
  input: DepositAssetLiquidityInput;
};


export type MutationDepositEventLiquidityArgs = {
  input: DepositEventLiquidityInput;
};


export type MutationDepositOutgoingPaymentLiquidityArgs = {
  input: DepositOutgoingPaymentLiquidityInput;
};


export type MutationDepositPeerLiquidityArgs = {
  input: DepositPeerLiquidityInput;
};


export type MutationPostLiquidityWithdrawalArgs = {
  input: PostLiquidityWithdrawalInput;
};


export type MutationRevokeWalletAddressKeyArgs = {
  input: RevokeWalletAddressKeyInput;
};


export type MutationSetFeeArgs = {
  input: SetFeeInput;
};


export type MutationTriggerWalletAddressEventsArgs = {
  input: TriggerWalletAddressEventsInput;
};


export type MutationUpdateAssetArgs = {
  input: UpdateAssetInput;
};


export type MutationUpdateIncomingPaymentArgs = {
  input: UpdateIncomingPaymentInput;
};


export type MutationUpdatePeerArgs = {
  input: UpdatePeerInput;
};


export type MutationUpdateTenantArgs = {
  input: UpdateTenantInput;
};


export type MutationUpdateWalletAddressArgs = {
  input: UpdateWalletAddressInput;
};


export type MutationVoidLiquidityWithdrawalArgs = {
  input: VoidLiquidityWithdrawalInput;
};


export type MutationWithdrawEventLiquidityArgs = {
  input: WithdrawEventLiquidityInput;
};

export type OutgoingPayment = BasePayment & Model & {
  __typename?: 'OutgoingPayment';
  /** Information about the wallet address of the Open Payments client that created the outgoing payment. */
  client?: Maybe<Scalars['String']['output']>;
  /** The date and time that the outgoing payment was created. */
  createdAt: Scalars['String']['output'];
  /** Amount to send (fixed send). */
  debitAmount: Amount;
  /** Any error encountered during the payment process. */
  error?: Maybe<Scalars['String']['output']>;
  /** Unique identifier of the grant under which the outgoing payment was created. */
  grantId?: Maybe<Scalars['String']['output']>;
  /** Unique identifier of the outgoing payment. */
  id: Scalars['ID']['output'];
  /** Current amount of liquidity available for this outgoing payment. */
  liquidity?: Maybe<Scalars['UInt64']['output']>;
  /** Additional metadata associated with the outgoing payment. */
  metadata?: Maybe<Scalars['JSONObject']['output']>;
  /** Corresponding quote for the outgoing payment. */
  quote?: Maybe<Quote>;
  /** Amount to receive (fixed receive). */
  receiveAmount: Amount;
  /** Wallet address URL of the receiver. */
  receiver: Scalars['String']['output'];
  /** Amount already sent. */
  sentAmount: Amount;
  /** State of the outgoing payment. */
  state: OutgoingPaymentState;
  /** Number of attempts made to send an outgoing payment. */
  stateAttempts: Scalars['Int']['output'];
  /** Tenant ID of the wallet address. */
  tenantId?: Maybe<Scalars['String']['output']>;
  /** Unique identifier of the wallet address under which the outgoing payment was created. */
  walletAddressId: Scalars['ID']['output'];
};

export type OutgoingPaymentConnection = {
  __typename?: 'OutgoingPaymentConnection';
  /** A list of outgoing payment edges, containing outgoing payment nodes and cursors for pagination. */
  edges: Array<OutgoingPaymentEdge>;
  /** Pagination information for the outgoing payments. */
  pageInfo: PageInfo;
};

export type OutgoingPaymentEdge = {
  __typename?: 'OutgoingPaymentEdge';
  /** A cursor for paginating through the outgoing payments. */
  cursor: Scalars['String']['output'];
  /** An outgoing payment node in the list. */
  node: OutgoingPayment;
};

export type OutgoingPaymentFilter = {
  /** Filter for outgoing payments based on the receiver's details. */
  receiver?: InputMaybe<FilterString>;
  /** Filter for outgoing payments based on their state. */
  state?: InputMaybe<FilterString>;
  /** Filter for outgoing payments based on the wallet address ID. */
  walletAddressId?: InputMaybe<FilterString>;
};

export type OutgoingPaymentResponse = {
  __typename?: 'OutgoingPaymentResponse';
  /** The outgoing payment object returned in the response. */
  payment?: Maybe<OutgoingPayment>;
};

export enum OutgoingPaymentState {
  /** The payment has been canceled. */
  Cancelled = 'CANCELLED',
  /** The payment has been successfully completed. */
  Completed = 'COMPLETED',
  /** The payment has failed. */
  Failed = 'FAILED',
  /** The payment is reserving funds and will transition to `SENDING` once funds are secured. */
  Funding = 'FUNDING',
  /** The payment is in progress and will transition to `COMPLETED` upon success. */
  Sending = 'SENDING'
}

export type PageInfo = {
  __typename?: 'PageInfo';
  /** The cursor used to fetch the next page when paginating forwards. */
  endCursor?: Maybe<Scalars['String']['output']>;
  /** Indicates if there are more pages when paginating forwards. */
  hasNextPage: Scalars['Boolean']['output'];
  /** Indicates if there are more pages when paginating backwards. */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** The cursor used to fetch the next page when paginating backwards. */
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Payment = BasePayment & Model & {
  __typename?: 'Payment';
  /** Information about the wallet address of the Open Payments client that created the payment. */
  client?: Maybe<Scalars['String']['output']>;
  /** The date and time that the payment was created. */
  createdAt: Scalars['String']['output'];
  /** Unique identifier of the payment. */
  id: Scalars['ID']['output'];
  /** Current amount of liquidity available for this payment. */
  liquidity?: Maybe<Scalars['UInt64']['output']>;
  /** Additional metadata associated with the payment. */
  metadata?: Maybe<Scalars['JSONObject']['output']>;
  /** State of the payment, either `IncomingPaymentState` or `OutgoingPaymentState` according to payment type */
  state: Scalars['String']['output'];
  /** Type of payment, either incoming or outgoing. */
  type: PaymentType;
  /** Unique identifier of the wallet address under which the payment was created. */
  walletAddressId: Scalars['ID']['output'];
};

export type PaymentConnection = {
  __typename?: 'PaymentConnection';
  /** A list of payment edges, containing payment nodes and cursors for pagination. */
  edges: Array<PaymentEdge>;
  /** Pagination information for the payments. */
  pageInfo: PageInfo;
};

export type PaymentEdge = {
  __typename?: 'PaymentEdge';
  /** A cursor for paginating through the payments. */
  cursor: Scalars['String']['output'];
  /** A payment node in the list. */
  node: Payment;
};

export type PaymentFilter = {
  /** Filter for payments based on their type. */
  type?: InputMaybe<FilterString>;
  /** Filter for payments based on the wallet address ID. */
  walletAddressId?: InputMaybe<FilterString>;
};

export enum PaymentType {
  /** Represents an incoming payment. */
  Incoming = 'INCOMING',
  /** Represents an outgoing payment. */
  Outgoing = 'OUTGOING'
}

export type Peer = Model & {
  __typename?: 'Peer';
  /** Asset of peering relationship. */
  asset: Asset;
  /** The date and time when the peer was created. */
  createdAt: Scalars['String']['output'];
  /** Peering connection details. */
  http: Http;
  /** Unique identifier of the peer. */
  id: Scalars['ID']['output'];
  /** Current amount of peer liquidity available. */
  liquidity?: Maybe<Scalars['UInt64']['output']>;
  /** A webhook event will notify the Account Servicing Entity if liquidity falls below this value. */
  liquidityThreshold?: Maybe<Scalars['UInt64']['output']>;
  /** Maximum packet amount that the peer accepts. */
  maxPacketAmount?: Maybe<Scalars['UInt64']['output']>;
  /** Public name for the peer. */
  name?: Maybe<Scalars['String']['output']>;
  /** ILP address of the peer. */
  staticIlpAddress: Scalars['String']['output'];
};

export type PeerEdge = {
  __typename?: 'PeerEdge';
  /** A cursor for paginating through the peers. */
  cursor: Scalars['String']['output'];
  /** A peer node in the list. */
  node: Peer;
};

export type PeersConnection = {
  __typename?: 'PeersConnection';
  /** A list of edges representing peers and cursors for pagination. */
  edges: Array<PeerEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
};

export type PostLiquidityWithdrawalInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the liquidity withdrawal to post. */
  withdrawalId: Scalars['String']['input'];
};

export type Query = {
  __typename?: 'Query';
  /** Fetch a paginated list of accounting transfers for a given account. */
  accountingTransfers: AccountingTransferConnection;
  /** Fetch an asset by its ID. */
  asset?: Maybe<Asset>;
  /** Get an asset based on its currency code and scale if it exists. */
  assetByCodeAndScale?: Maybe<Asset>;
  /** Fetch a paginated list of assets. */
  assets: AssetsConnection;
  /** Fetch an Open Payments incoming payment by its ID. */
  incomingPayment?: Maybe<IncomingPayment>;
  /** Fetch an Open Payments outgoing payment by its ID. */
  outgoingPayment?: Maybe<OutgoingPayment>;
  /** Fetch a paginated list of outgoing payments by receiver. */
  outgoingPayments: OutgoingPaymentConnection;
  /** Fetch a paginated list of combined payments, including incoming and outgoing payments. */
  payments: PaymentConnection;
  /** Fetch a peer by its ID. */
  peer?: Maybe<Peer>;
  /** Get a peer based on its ILP address and asset ID if it exists. */
  peerByAddressAndAsset?: Maybe<Peer>;
  /** Fetch a paginated list of peers. */
  peers: PeersConnection;
  /** Fetch an Open Payments quote by its ID and tenant ID. */
  quote?: Maybe<Quote>;
  /** Retrieve an Open Payments incoming payment by receiver ID. The receiver's wallet address can be hosted on this server or a remote Open Payments resource server. */
  receiver?: Maybe<Receiver>;
  /** Retrieve a tenant of the instance. */
  tenant: Tenant;
  /** As an operator, fetch a paginated list of tenants on the instance. */
  tenants: TenantsConnection;
  /** Fetch a wallet address by its ID. */
  walletAddress?: Maybe<WalletAddress>;
  /** Get a wallet address by its url if it exists */
  walletAddressByUrl?: Maybe<WalletAddress>;
  /** Fetch a paginated list of wallet addresses. */
  walletAddresses: WalletAddressesConnection;
  /** Fetch a paginated list of webhook events. */
  webhookEvents: WebhookEventsConnection;
  /** Determine if the requester has operator permissions */
  whoami: WhoamiResponse;
};


export type QueryAccountingTransfersArgs = {
  id: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAssetArgs = {
  id: Scalars['String']['input'];
};


export type QueryAssetByCodeAndScaleArgs = {
  code: Scalars['String']['input'];
  scale: Scalars['UInt8']['input'];
};


export type QueryAssetsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};


export type QueryIncomingPaymentArgs = {
  id: Scalars['String']['input'];
};


export type QueryOutgoingPaymentArgs = {
  id: Scalars['String']['input'];
};


export type QueryOutgoingPaymentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<OutgoingPaymentFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
  tenantId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPaymentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<PaymentFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
  tenantId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPeerArgs = {
  id: Scalars['String']['input'];
};


export type QueryPeerByAddressAndAssetArgs = {
  assetId: Scalars['String']['input'];
  staticIlpAddress: Scalars['String']['input'];
};


export type QueryPeersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};


export type QueryQuoteArgs = {
  id: Scalars['String']['input'];
};


export type QueryReceiverArgs = {
  id: Scalars['String']['input'];
};


export type QueryTenantArgs = {
  id: Scalars['String']['input'];
};


export type QueryTenantsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};


export type QueryWalletAddressArgs = {
  id: Scalars['String']['input'];
};


export type QueryWalletAddressByUrlArgs = {
  url: Scalars['String']['input'];
};


export type QueryWalletAddressesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
  tenantId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryWebhookEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<WebhookEventFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};

export type Quote = {
  __typename?: 'Quote';
  /** The date and time that the quote was created. */
  createdAt: Scalars['String']['output'];
  /** Amount to send (fixed send). */
  debitAmount: Amount;
  /** Estimated exchange rate for this quote. */
  estimatedExchangeRate?: Maybe<Scalars['Float']['output']>;
  /** The date and time that the quote will expire. */
  expiresAt: Scalars['String']['output'];
  /** Unique identifier of the quote. */
  id: Scalars['ID']['output'];
  /** Amount to receive (fixed receive). */
  receiveAmount: Amount;
  /** Wallet address URL of the receiver. */
  receiver: Scalars['String']['output'];
  /** Unique identifier of the tenant under which the quote was created. */
  tenantId: Scalars['ID']['output'];
  /** Unique identifier of the wallet address under which the quote was created. */
  walletAddressId: Scalars['ID']['output'];
};

export type QuoteConnection = {
  __typename?: 'QuoteConnection';
  /** A list of quote edges, containing quote nodes and cursors for pagination. */
  edges: Array<QuoteEdge>;
  /** Pagination information for quotes. */
  pageInfo: PageInfo;
};

export type QuoteEdge = {
  __typename?: 'QuoteEdge';
  /** A cursor for paginating through the quotes. */
  cursor: Scalars['String']['output'];
  /** A quote node in the list. */
  node: Quote;
};

export type QuoteResponse = {
  __typename?: 'QuoteResponse';
  /** The quote object returned in the response. */
  quote?: Maybe<Quote>;
};

export type Receiver = {
  __typename?: 'Receiver';
  /** Indicates whether the incoming payment has completed receiving funds. */
  completed: Scalars['Boolean']['output'];
  /** The date and time that the incoming payment was created. */
  createdAt: Scalars['String']['output'];
  /** Date and time that the incoming payment will expire. After this time, the incoming payment will not accept further payments made to it. */
  expiresAt?: Maybe<Scalars['String']['output']>;
  /** Unique identifier of the receiver (incoming payment URL). */
  id: Scalars['String']['output'];
  /** The maximum amount that should be paid into the wallet address under this incoming payment. */
  incomingAmount?: Maybe<Amount>;
  /** Additional metadata associated with the incoming payment. */
  metadata?: Maybe<Scalars['JSONObject']['output']>;
  /** The total amount that has been paid into the wallet address under this incoming payment. */
  receivedAmount: Amount;
  /** The date and time that the incoming payment was last updated. */
  updatedAt: Scalars['String']['output'];
  /** Wallet address URL under which the incoming payment was created. */
  walletAddressUrl: Scalars['String']['output'];
};

export type RevokeWalletAddressKeyInput = {
  /** Internal unique identifier of the key to revoke. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
};

export type RevokeWalletAddressKeyMutationResponse = {
  __typename?: 'RevokeWalletAddressKeyMutationResponse';
  /** The wallet address key that was revoked. */
  walletAddressKey?: Maybe<WalletAddressKey>;
};

export type SetFeeInput = {
  /** Unique identifier of the asset id to add the fees to. */
  assetId: Scalars['ID']['input'];
  /** Fee values */
  fee: FeeDetails;
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Type of fee, either sending or receiving. */
  type: FeeType;
};

export type SetFeeResponse = {
  __typename?: 'SetFeeResponse';
  /** The fee that was set. */
  fee?: Maybe<Fee>;
};

export enum SortOrder {
  /** Sort the results in ascending order. */
  Asc = 'ASC',
  /** Sort the results in descending order. */
  Desc = 'DESC'
}

export type Tenant = Model & {
  __typename?: 'Tenant';
  /** Secret used to secure requests made for this tenant. */
  apiSecret: Scalars['String']['output'];
  /** The date and time that this tenant was created. */
  createdAt: Scalars['String']['output'];
  /** The date and time that this tenant was deleted. */
  deletedAt?: Maybe<Scalars['String']['output']>;
  /** Contact email of the tenant owner. */
  email?: Maybe<Scalars['String']['output']>;
  /** Unique identifier of the tenant. */
  id: Scalars['ID']['output'];
  /** URL of the tenant's identity provider's consent screen. */
  idpConsentUrl?: Maybe<Scalars['String']['output']>;
  /** Secret used to secure requests from the tenant's identity provider. */
  idpSecret?: Maybe<Scalars['String']['output']>;
  /** Public name for the tenant. */
  publicName?: Maybe<Scalars['String']['output']>;
};

export type TenantEdge = {
  __typename?: 'TenantEdge';
  /** A cursor for paginating through the tenants. */
  cursor: Scalars['String']['output'];
  /** A tenant node in the list. */
  node: Tenant;
};

export type TenantMutationResponse = {
  __typename?: 'TenantMutationResponse';
  tenant: Tenant;
};

export type TenantsConnection = {
  __typename?: 'TenantsConnection';
  /** A list of edges representing tenants and cursors for pagination. */
  edges: Array<TenantEdge>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
};

export enum TransferState {
  /** The accounting transfer is pending */
  Pending = 'PENDING',
  /** The accounting transfer is posted */
  Posted = 'POSTED',
  /** The accounting transfer is voided */
  Voided = 'VOIDED'
}

export enum TransferType {
  /** Represents a deposit transfer. */
  Deposit = 'DEPOSIT',
  /** Represents a generic transfer within Rafiki. */
  Transfer = 'TRANSFER',
  /** Represents a withdrawal transfer. */
  Withdrawal = 'WITHDRAWAL'
}

export type TriggerWalletAddressEventsInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** Maximum number of events being triggered (n). */
  limit: Scalars['Int']['input'];
};

export type TriggerWalletAddressEventsMutationResponse = {
  __typename?: 'TriggerWalletAddressEventsMutationResponse';
  /** The number of events that were triggered. */
  count?: Maybe<Scalars['Int']['output']>;
};

export type UpdateAssetInput = {
  /** Unique identifier of the asset to update. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** A webhook event will notify the Account Servicing Entity if liquidity falls below this new value. */
  liquidityThreshold?: InputMaybe<Scalars['UInt64']['input']>;
  /** New minimum amount of liquidity that can be withdrawn from the asset. */
  withdrawalThreshold?: InputMaybe<Scalars['UInt64']['input']>;
};

export type UpdateIncomingPaymentInput = {
  /** Unique identifier of the incoming payment to update. */
  id: Scalars['ID']['input'];
  /** The new metadata object to save for the incoming payment. It will overwrite any existing metadata. */
  metadata: Scalars['JSONObject']['input'];
};

export type UpdatePeerInput = {
  /** New peering connection details. */
  http?: InputMaybe<HttpInput>;
  /** Unique identifier of the peer to update. */
  id: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** A webhook event will notify the Account Servicing Entity if peer liquidity falls below this new value. */
  liquidityThreshold?: InputMaybe<Scalars['UInt64']['input']>;
  /** New maximum packet amount that the peer accepts. */
  maxPacketAmount?: InputMaybe<Scalars['UInt64']['input']>;
  /** New public name for the peer. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** New ILP address for the peer. */
  staticIlpAddress?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePeerMutationResponse = {
  __typename?: 'UpdatePeerMutationResponse';
  /** The peer that was updated. */
  peer?: Maybe<Peer>;
};

export type UpdateTenantInput = {
  /** Secret used to secure requests made for this tenant. */
  apiSecret?: InputMaybe<Scalars['String']['input']>;
  /** Contact email of the tenant owner. */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Unique identifier of the tenant. */
  id: Scalars['ID']['input'];
  /** URL of the tenant's identity provider's consent screen. */
  idpConsentUrl?: InputMaybe<Scalars['String']['input']>;
  /** Secret used to secure requests from the tenant's identity provider. */
  idpSecret?: InputMaybe<Scalars['String']['input']>;
  /** Public name for the tenant. */
  publicName?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateWalletAddressInput = {
  /** Additional properties associated with this wallet address. */
  additionalProperties?: InputMaybe<Array<AdditionalPropertyInput>>;
  /** Unique identifier of the wallet address to update. This cannot be changed. */
  id: Scalars['ID']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  /** New public name for the wallet address. This is visible to anyone with the wallet address URL. */
  publicName?: InputMaybe<Scalars['String']['input']>;
  /** New status to set the wallet address to, either active or inactive. */
  status?: InputMaybe<WalletAddressStatus>;
};

export type UpdateWalletAddressMutationResponse = {
  __typename?: 'UpdateWalletAddressMutationResponse';
  /** The updated wallet address. */
  walletAddress?: Maybe<WalletAddress>;
};

export type VoidLiquidityWithdrawalInput = {
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
  /** Unique identifier of the liquidity withdrawal to void. */
  withdrawalId: Scalars['String']['input'];
};

export type WalletAddress = Model & {
  __typename?: 'WalletAddress';
  /** Additional properties associated with the wallet address. */
  additionalProperties?: Maybe<Array<Maybe<AdditionalProperty>>>;
  /** Asset of the wallet address. */
  asset: Asset;
  /** The date and time when the wallet address was created. */
  createdAt: Scalars['String']['output'];
  /** Unique identifier of the wallet address. */
  id: Scalars['ID']['output'];
  /** List of incoming payments received by this wallet address */
  incomingPayments?: Maybe<IncomingPaymentConnection>;
  /** Current amount of liquidity available for this wallet address. */
  liquidity?: Maybe<Scalars['UInt64']['output']>;
  /** List of outgoing payments sent from this wallet address */
  outgoingPayments?: Maybe<OutgoingPaymentConnection>;
  /** Public name associated with the wallet address. This is visible to anyone with the wallet address URL. */
  publicName?: Maybe<Scalars['String']['output']>;
  /** List of quotes created at this wallet address */
  quotes?: Maybe<QuoteConnection>;
  /** The current status of the wallet, either active or inactive. */
  status: WalletAddressStatus;
  /** Tenant ID of the wallet address. */
  tenantId?: Maybe<Scalars['String']['output']>;
  /** Wallet Address URL. */
  url: Scalars['String']['output'];
  /** List of keys associated with this wallet address */
  walletAddressKeys?: Maybe<WalletAddressKeyConnection>;
};


export type WalletAddressIncomingPaymentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};


export type WalletAddressOutgoingPaymentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};


export type WalletAddressQuotesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};


export type WalletAddressWalletAddressKeysArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortOrder?: InputMaybe<SortOrder>;
};

export type WalletAddressEdge = {
  __typename?: 'WalletAddressEdge';
  /** A cursor for paginating through the wallet addresses. */
  cursor: Scalars['String']['output'];
  /** A wallet address node in the list. */
  node: WalletAddress;
};

export type WalletAddressKey = Model & {
  __typename?: 'WalletAddressKey';
  /** The date and time that this wallet address key was created. */
  createdAt: Scalars['String']['output'];
  /** Unique internal identifier for the wallet address key. */
  id: Scalars['ID']['output'];
  /** The public key object in JSON Web Key (JWK) format. */
  jwk: Jwk;
  /** Indicator of whether the key has been revoked. */
  revoked: Scalars['Boolean']['output'];
  /** Unique identifier of the wallet address to associate with the key. */
  walletAddressId: Scalars['ID']['output'];
};

export type WalletAddressKeyConnection = {
  __typename?: 'WalletAddressKeyConnection';
  /** A list of wallet address key edges, containing wallet address key nodes and cursors for pagination. */
  edges: Array<WalletAddressKeyEdge>;
  /** Pagination information for wallet address keys. */
  pageInfo: PageInfo;
};

export type WalletAddressKeyEdge = {
  __typename?: 'WalletAddressKeyEdge';
  /** A cursor for paginating through the wallet address keys. */
  cursor: Scalars['String']['output'];
  /** A wallet address key node in the list. */
  node: WalletAddressKey;
};

export enum WalletAddressStatus {
  /** The default status of a wallet address. */
  Active = 'ACTIVE',
  /** The status after deactivating a wallet address. */
  Inactive = 'INACTIVE'
}

export type WalletAddressWithdrawal = {
  __typename?: 'WalletAddressWithdrawal';
  /** Amount to be withdrawn. */
  amount: Scalars['UInt64']['output'];
  /** Unique identifier for the withdrawal. */
  id: Scalars['ID']['output'];
  /** Details about the wallet address from which the withdrawal is made. */
  walletAddress: WalletAddress;
};

export type WalletAddressWithdrawalMutationResponse = {
  __typename?: 'WalletAddressWithdrawalMutationResponse';
  /** The wallet address withdrawal that was processed. */
  withdrawal?: Maybe<WalletAddressWithdrawal>;
};

export type WalletAddressesConnection = {
  __typename?: 'WalletAddressesConnection';
  /** A list of wallet address edges, containing wallet address nodes and cursors for pagination. */
  edges: Array<WalletAddressEdge>;
  /** Pagination information for the wallet addresses. */
  pageInfo: PageInfo;
};

export type WebhookEvent = Model & {
  __typename?: 'WebhookEvent';
  /** The date and time when the webhook event was created. */
  createdAt: Scalars['String']['output'];
  /** Stringified JSON data for the webhook event. */
  data: Scalars['JSONObject']['output'];
  /** Unique identifier of the webhook event. */
  id: Scalars['ID']['output'];
  /** Type of webhook event. */
  type: Scalars['String']['output'];
};

export type WebhookEventFilter = {
  /** Filter for webhook events based on their type. */
  type?: InputMaybe<FilterString>;
};

export type WebhookEventsConnection = {
  __typename?: 'WebhookEventsConnection';
  /** A list of webhook event edges, containing event nodes and cursors for pagination. */
  edges: Array<WebhookEventsEdge>;
  /** Pagination information for webhook events. */
  pageInfo: PageInfo;
};

export type WebhookEventsEdge = {
  __typename?: 'WebhookEventsEdge';
  /** A cursor for paginating through the webhook events. */
  cursor: Scalars['String']['output'];
  /** A webhook event node in the list. */
  node: WebhookEvent;
};

export type WhoamiResponse = {
  __typename?: 'WhoamiResponse';
  id: Scalars['String']['output'];
  isOperator: Scalars['Boolean']['output'];
};

export type WithdrawEventLiquidityInput = {
  /** Unique identifier of the event to withdraw liquidity from. */
  eventId: Scalars['String']['input'];
  /** Unique key to ensure duplicate or retried requests are processed only once. For more information, refer to [idempotency](https://rafiki.dev/apis/graphql/admin-api-overview/#idempotency). */
  idempotencyKey: Scalars['String']['input'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;


/** Mapping of interface types */
export type ResolversInterfaceTypes<RefType extends Record<string, unknown>> = {
  BasePayment: ( Partial<IncomingPayment> ) | ( Partial<OutgoingPayment> ) | ( Partial<Payment> );
  Model: ( Partial<AccountingTransfer> ) | ( Partial<Asset> ) | ( Partial<Fee> ) | ( Partial<IncomingPayment> ) | ( Partial<OutgoingPayment> ) | ( Partial<Payment> ) | ( Partial<Peer> ) | ( Partial<Tenant> ) | ( Partial<WalletAddress> ) | ( Partial<WalletAddressKey> ) | ( Partial<WebhookEvent> );
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AccountingTransfer: ResolverTypeWrapper<Partial<AccountingTransfer>>;
  AccountingTransferConnection: ResolverTypeWrapper<Partial<AccountingTransferConnection>>;
  AdditionalProperty: ResolverTypeWrapper<Partial<AdditionalProperty>>;
  AdditionalPropertyInput: ResolverTypeWrapper<Partial<AdditionalPropertyInput>>;
  Alg: ResolverTypeWrapper<Partial<Alg>>;
  Amount: ResolverTypeWrapper<Partial<Amount>>;
  AmountInput: ResolverTypeWrapper<Partial<AmountInput>>;
  ApproveIncomingPaymentInput: ResolverTypeWrapper<Partial<ApproveIncomingPaymentInput>>;
  ApproveIncomingPaymentResponse: ResolverTypeWrapper<Partial<ApproveIncomingPaymentResponse>>;
  Asset: ResolverTypeWrapper<Partial<Asset>>;
  AssetEdge: ResolverTypeWrapper<Partial<AssetEdge>>;
  AssetMutationResponse: ResolverTypeWrapper<Partial<AssetMutationResponse>>;
  AssetsConnection: ResolverTypeWrapper<Partial<AssetsConnection>>;
  BasePayment: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['BasePayment']>;
  Boolean: ResolverTypeWrapper<Partial<Scalars['Boolean']['output']>>;
  CancelIncomingPaymentInput: ResolverTypeWrapper<Partial<CancelIncomingPaymentInput>>;
  CancelIncomingPaymentResponse: ResolverTypeWrapper<Partial<CancelIncomingPaymentResponse>>;
  CancelOutgoingPaymentInput: ResolverTypeWrapper<Partial<CancelOutgoingPaymentInput>>;
  CreateAssetInput: ResolverTypeWrapper<Partial<CreateAssetInput>>;
  CreateAssetLiquidityWithdrawalInput: ResolverTypeWrapper<Partial<CreateAssetLiquidityWithdrawalInput>>;
  CreateIncomingPaymentInput: ResolverTypeWrapper<Partial<CreateIncomingPaymentInput>>;
  CreateIncomingPaymentWithdrawalInput: ResolverTypeWrapper<Partial<CreateIncomingPaymentWithdrawalInput>>;
  CreateOrUpdatePeerByUrlInput: ResolverTypeWrapper<Partial<CreateOrUpdatePeerByUrlInput>>;
  CreateOrUpdatePeerByUrlMutationResponse: ResolverTypeWrapper<Partial<CreateOrUpdatePeerByUrlMutationResponse>>;
  CreateOutgoingPaymentFromIncomingPaymentInput: ResolverTypeWrapper<Partial<CreateOutgoingPaymentFromIncomingPaymentInput>>;
  CreateOutgoingPaymentInput: ResolverTypeWrapper<Partial<CreateOutgoingPaymentInput>>;
  CreateOutgoingPaymentWithdrawalInput: ResolverTypeWrapper<Partial<CreateOutgoingPaymentWithdrawalInput>>;
  CreatePeerInput: ResolverTypeWrapper<Partial<CreatePeerInput>>;
  CreatePeerLiquidityWithdrawalInput: ResolverTypeWrapper<Partial<CreatePeerLiquidityWithdrawalInput>>;
  CreatePeerMutationResponse: ResolverTypeWrapper<Partial<CreatePeerMutationResponse>>;
  CreateQuoteInput: ResolverTypeWrapper<Partial<CreateQuoteInput>>;
  CreateReceiverInput: ResolverTypeWrapper<Partial<CreateReceiverInput>>;
  CreateReceiverResponse: ResolverTypeWrapper<Partial<CreateReceiverResponse>>;
  CreateTenantInput: ResolverTypeWrapper<Partial<CreateTenantInput>>;
  CreateWalletAddressInput: ResolverTypeWrapper<Partial<CreateWalletAddressInput>>;
  CreateWalletAddressKeyInput: ResolverTypeWrapper<Partial<CreateWalletAddressKeyInput>>;
  CreateWalletAddressKeyMutationResponse: ResolverTypeWrapper<Partial<CreateWalletAddressKeyMutationResponse>>;
  CreateWalletAddressMutationResponse: ResolverTypeWrapper<Partial<CreateWalletAddressMutationResponse>>;
  CreateWalletAddressWithdrawalInput: ResolverTypeWrapper<Partial<CreateWalletAddressWithdrawalInput>>;
  Crv: ResolverTypeWrapper<Partial<Crv>>;
  DeleteAssetInput: ResolverTypeWrapper<Partial<DeleteAssetInput>>;
  DeleteAssetMutationResponse: ResolverTypeWrapper<Partial<DeleteAssetMutationResponse>>;
  DeletePeerInput: ResolverTypeWrapper<Partial<DeletePeerInput>>;
  DeletePeerMutationResponse: ResolverTypeWrapper<Partial<DeletePeerMutationResponse>>;
  DeleteTenantMutationResponse: ResolverTypeWrapper<Partial<DeleteTenantMutationResponse>>;
  DepositAssetLiquidityInput: ResolverTypeWrapper<Partial<DepositAssetLiquidityInput>>;
  DepositEventLiquidityInput: ResolverTypeWrapper<Partial<DepositEventLiquidityInput>>;
  DepositOutgoingPaymentLiquidityInput: ResolverTypeWrapper<Partial<DepositOutgoingPaymentLiquidityInput>>;
  DepositPeerLiquidityInput: ResolverTypeWrapper<Partial<DepositPeerLiquidityInput>>;
  Fee: ResolverTypeWrapper<Partial<Fee>>;
  FeeDetails: ResolverTypeWrapper<Partial<FeeDetails>>;
  FeeEdge: ResolverTypeWrapper<Partial<FeeEdge>>;
  FeeType: ResolverTypeWrapper<Partial<FeeType>>;
  FeesConnection: ResolverTypeWrapper<Partial<FeesConnection>>;
  FilterString: ResolverTypeWrapper<Partial<FilterString>>;
  Float: ResolverTypeWrapper<Partial<Scalars['Float']['output']>>;
  Http: ResolverTypeWrapper<Partial<Http>>;
  HttpIncomingInput: ResolverTypeWrapper<Partial<HttpIncomingInput>>;
  HttpInput: ResolverTypeWrapper<Partial<HttpInput>>;
  HttpOutgoing: ResolverTypeWrapper<Partial<HttpOutgoing>>;
  HttpOutgoingInput: ResolverTypeWrapper<Partial<HttpOutgoingInput>>;
  ID: ResolverTypeWrapper<Partial<Scalars['ID']['output']>>;
  IncomingPayment: ResolverTypeWrapper<Partial<IncomingPayment>>;
  IncomingPaymentConnection: ResolverTypeWrapper<Partial<IncomingPaymentConnection>>;
  IncomingPaymentEdge: ResolverTypeWrapper<Partial<IncomingPaymentEdge>>;
  IncomingPaymentResponse: ResolverTypeWrapper<Partial<IncomingPaymentResponse>>;
  IncomingPaymentState: ResolverTypeWrapper<Partial<IncomingPaymentState>>;
  Int: ResolverTypeWrapper<Partial<Scalars['Int']['output']>>;
  JSONObject: ResolverTypeWrapper<Partial<Scalars['JSONObject']['output']>>;
  Jwk: ResolverTypeWrapper<Partial<Jwk>>;
  JwkInput: ResolverTypeWrapper<Partial<JwkInput>>;
  Kty: ResolverTypeWrapper<Partial<Kty>>;
  LiquidityError: ResolverTypeWrapper<Partial<LiquidityError>>;
  LiquidityMutationResponse: ResolverTypeWrapper<Partial<LiquidityMutationResponse>>;
  Model: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Model']>;
  Mutation: ResolverTypeWrapper<{}>;
  OutgoingPayment: ResolverTypeWrapper<Partial<OutgoingPayment>>;
  OutgoingPaymentConnection: ResolverTypeWrapper<Partial<OutgoingPaymentConnection>>;
  OutgoingPaymentEdge: ResolverTypeWrapper<Partial<OutgoingPaymentEdge>>;
  OutgoingPaymentFilter: ResolverTypeWrapper<Partial<OutgoingPaymentFilter>>;
  OutgoingPaymentResponse: ResolverTypeWrapper<Partial<OutgoingPaymentResponse>>;
  OutgoingPaymentState: ResolverTypeWrapper<Partial<OutgoingPaymentState>>;
  PageInfo: ResolverTypeWrapper<Partial<PageInfo>>;
  Payment: ResolverTypeWrapper<Partial<Payment>>;
  PaymentConnection: ResolverTypeWrapper<Partial<PaymentConnection>>;
  PaymentEdge: ResolverTypeWrapper<Partial<PaymentEdge>>;
  PaymentFilter: ResolverTypeWrapper<Partial<PaymentFilter>>;
  PaymentType: ResolverTypeWrapper<Partial<PaymentType>>;
  Peer: ResolverTypeWrapper<Partial<Peer>>;
  PeerEdge: ResolverTypeWrapper<Partial<PeerEdge>>;
  PeersConnection: ResolverTypeWrapper<Partial<PeersConnection>>;
  PostLiquidityWithdrawalInput: ResolverTypeWrapper<Partial<PostLiquidityWithdrawalInput>>;
  Query: ResolverTypeWrapper<{}>;
  Quote: ResolverTypeWrapper<Partial<Quote>>;
  QuoteConnection: ResolverTypeWrapper<Partial<QuoteConnection>>;
  QuoteEdge: ResolverTypeWrapper<Partial<QuoteEdge>>;
  QuoteResponse: ResolverTypeWrapper<Partial<QuoteResponse>>;
  Receiver: ResolverTypeWrapper<Partial<Receiver>>;
  RevokeWalletAddressKeyInput: ResolverTypeWrapper<Partial<RevokeWalletAddressKeyInput>>;
  RevokeWalletAddressKeyMutationResponse: ResolverTypeWrapper<Partial<RevokeWalletAddressKeyMutationResponse>>;
  SetFeeInput: ResolverTypeWrapper<Partial<SetFeeInput>>;
  SetFeeResponse: ResolverTypeWrapper<Partial<SetFeeResponse>>;
  SortOrder: ResolverTypeWrapper<Partial<SortOrder>>;
  String: ResolverTypeWrapper<Partial<Scalars['String']['output']>>;
  Tenant: ResolverTypeWrapper<Partial<Tenant>>;
  TenantEdge: ResolverTypeWrapper<Partial<TenantEdge>>;
  TenantMutationResponse: ResolverTypeWrapper<Partial<TenantMutationResponse>>;
  TenantsConnection: ResolverTypeWrapper<Partial<TenantsConnection>>;
  TransferState: ResolverTypeWrapper<Partial<TransferState>>;
  TransferType: ResolverTypeWrapper<Partial<TransferType>>;
  TriggerWalletAddressEventsInput: ResolverTypeWrapper<Partial<TriggerWalletAddressEventsInput>>;
  TriggerWalletAddressEventsMutationResponse: ResolverTypeWrapper<Partial<TriggerWalletAddressEventsMutationResponse>>;
  UInt8: ResolverTypeWrapper<Partial<Scalars['UInt8']['output']>>;
  UInt64: ResolverTypeWrapper<Partial<Scalars['UInt64']['output']>>;
  UpdateAssetInput: ResolverTypeWrapper<Partial<UpdateAssetInput>>;
  UpdateIncomingPaymentInput: ResolverTypeWrapper<Partial<UpdateIncomingPaymentInput>>;
  UpdatePeerInput: ResolverTypeWrapper<Partial<UpdatePeerInput>>;
  UpdatePeerMutationResponse: ResolverTypeWrapper<Partial<UpdatePeerMutationResponse>>;
  UpdateTenantInput: ResolverTypeWrapper<Partial<UpdateTenantInput>>;
  UpdateWalletAddressInput: ResolverTypeWrapper<Partial<UpdateWalletAddressInput>>;
  UpdateWalletAddressMutationResponse: ResolverTypeWrapper<Partial<UpdateWalletAddressMutationResponse>>;
  VoidLiquidityWithdrawalInput: ResolverTypeWrapper<Partial<VoidLiquidityWithdrawalInput>>;
  WalletAddress: ResolverTypeWrapper<Partial<WalletAddress>>;
  WalletAddressEdge: ResolverTypeWrapper<Partial<WalletAddressEdge>>;
  WalletAddressKey: ResolverTypeWrapper<Partial<WalletAddressKey>>;
  WalletAddressKeyConnection: ResolverTypeWrapper<Partial<WalletAddressKeyConnection>>;
  WalletAddressKeyEdge: ResolverTypeWrapper<Partial<WalletAddressKeyEdge>>;
  WalletAddressStatus: ResolverTypeWrapper<Partial<WalletAddressStatus>>;
  WalletAddressWithdrawal: ResolverTypeWrapper<Partial<WalletAddressWithdrawal>>;
  WalletAddressWithdrawalMutationResponse: ResolverTypeWrapper<Partial<WalletAddressWithdrawalMutationResponse>>;
  WalletAddressesConnection: ResolverTypeWrapper<Partial<WalletAddressesConnection>>;
  WebhookEvent: ResolverTypeWrapper<Partial<WebhookEvent>>;
  WebhookEventFilter: ResolverTypeWrapper<Partial<WebhookEventFilter>>;
  WebhookEventsConnection: ResolverTypeWrapper<Partial<WebhookEventsConnection>>;
  WebhookEventsEdge: ResolverTypeWrapper<Partial<WebhookEventsEdge>>;
  WhoamiResponse: ResolverTypeWrapper<Partial<WhoamiResponse>>;
  WithdrawEventLiquidityInput: ResolverTypeWrapper<Partial<WithdrawEventLiquidityInput>>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AccountingTransfer: Partial<AccountingTransfer>;
  AccountingTransferConnection: Partial<AccountingTransferConnection>;
  AdditionalProperty: Partial<AdditionalProperty>;
  AdditionalPropertyInput: Partial<AdditionalPropertyInput>;
  Amount: Partial<Amount>;
  AmountInput: Partial<AmountInput>;
  ApproveIncomingPaymentInput: Partial<ApproveIncomingPaymentInput>;
  ApproveIncomingPaymentResponse: Partial<ApproveIncomingPaymentResponse>;
  Asset: Partial<Asset>;
  AssetEdge: Partial<AssetEdge>;
  AssetMutationResponse: Partial<AssetMutationResponse>;
  AssetsConnection: Partial<AssetsConnection>;
  BasePayment: ResolversInterfaceTypes<ResolversParentTypes>['BasePayment'];
  Boolean: Partial<Scalars['Boolean']['output']>;
  CancelIncomingPaymentInput: Partial<CancelIncomingPaymentInput>;
  CancelIncomingPaymentResponse: Partial<CancelIncomingPaymentResponse>;
  CancelOutgoingPaymentInput: Partial<CancelOutgoingPaymentInput>;
  CreateAssetInput: Partial<CreateAssetInput>;
  CreateAssetLiquidityWithdrawalInput: Partial<CreateAssetLiquidityWithdrawalInput>;
  CreateIncomingPaymentInput: Partial<CreateIncomingPaymentInput>;
  CreateIncomingPaymentWithdrawalInput: Partial<CreateIncomingPaymentWithdrawalInput>;
  CreateOrUpdatePeerByUrlInput: Partial<CreateOrUpdatePeerByUrlInput>;
  CreateOrUpdatePeerByUrlMutationResponse: Partial<CreateOrUpdatePeerByUrlMutationResponse>;
  CreateOutgoingPaymentFromIncomingPaymentInput: Partial<CreateOutgoingPaymentFromIncomingPaymentInput>;
  CreateOutgoingPaymentInput: Partial<CreateOutgoingPaymentInput>;
  CreateOutgoingPaymentWithdrawalInput: Partial<CreateOutgoingPaymentWithdrawalInput>;
  CreatePeerInput: Partial<CreatePeerInput>;
  CreatePeerLiquidityWithdrawalInput: Partial<CreatePeerLiquidityWithdrawalInput>;
  CreatePeerMutationResponse: Partial<CreatePeerMutationResponse>;
  CreateQuoteInput: Partial<CreateQuoteInput>;
  CreateReceiverInput: Partial<CreateReceiverInput>;
  CreateReceiverResponse: Partial<CreateReceiverResponse>;
  CreateTenantInput: Partial<CreateTenantInput>;
  CreateWalletAddressInput: Partial<CreateWalletAddressInput>;
  CreateWalletAddressKeyInput: Partial<CreateWalletAddressKeyInput>;
  CreateWalletAddressKeyMutationResponse: Partial<CreateWalletAddressKeyMutationResponse>;
  CreateWalletAddressMutationResponse: Partial<CreateWalletAddressMutationResponse>;
  CreateWalletAddressWithdrawalInput: Partial<CreateWalletAddressWithdrawalInput>;
  DeleteAssetInput: Partial<DeleteAssetInput>;
  DeleteAssetMutationResponse: Partial<DeleteAssetMutationResponse>;
  DeletePeerInput: Partial<DeletePeerInput>;
  DeletePeerMutationResponse: Partial<DeletePeerMutationResponse>;
  DeleteTenantMutationResponse: Partial<DeleteTenantMutationResponse>;
  DepositAssetLiquidityInput: Partial<DepositAssetLiquidityInput>;
  DepositEventLiquidityInput: Partial<DepositEventLiquidityInput>;
  DepositOutgoingPaymentLiquidityInput: Partial<DepositOutgoingPaymentLiquidityInput>;
  DepositPeerLiquidityInput: Partial<DepositPeerLiquidityInput>;
  Fee: Partial<Fee>;
  FeeDetails: Partial<FeeDetails>;
  FeeEdge: Partial<FeeEdge>;
  FeesConnection: Partial<FeesConnection>;
  FilterString: Partial<FilterString>;
  Float: Partial<Scalars['Float']['output']>;
  Http: Partial<Http>;
  HttpIncomingInput: Partial<HttpIncomingInput>;
  HttpInput: Partial<HttpInput>;
  HttpOutgoing: Partial<HttpOutgoing>;
  HttpOutgoingInput: Partial<HttpOutgoingInput>;
  ID: Partial<Scalars['ID']['output']>;
  IncomingPayment: Partial<IncomingPayment>;
  IncomingPaymentConnection: Partial<IncomingPaymentConnection>;
  IncomingPaymentEdge: Partial<IncomingPaymentEdge>;
  IncomingPaymentResponse: Partial<IncomingPaymentResponse>;
  Int: Partial<Scalars['Int']['output']>;
  JSONObject: Partial<Scalars['JSONObject']['output']>;
  Jwk: Partial<Jwk>;
  JwkInput: Partial<JwkInput>;
  LiquidityMutationResponse: Partial<LiquidityMutationResponse>;
  Model: ResolversInterfaceTypes<ResolversParentTypes>['Model'];
  Mutation: {};
  OutgoingPayment: Partial<OutgoingPayment>;
  OutgoingPaymentConnection: Partial<OutgoingPaymentConnection>;
  OutgoingPaymentEdge: Partial<OutgoingPaymentEdge>;
  OutgoingPaymentFilter: Partial<OutgoingPaymentFilter>;
  OutgoingPaymentResponse: Partial<OutgoingPaymentResponse>;
  PageInfo: Partial<PageInfo>;
  Payment: Partial<Payment>;
  PaymentConnection: Partial<PaymentConnection>;
  PaymentEdge: Partial<PaymentEdge>;
  PaymentFilter: Partial<PaymentFilter>;
  Peer: Partial<Peer>;
  PeerEdge: Partial<PeerEdge>;
  PeersConnection: Partial<PeersConnection>;
  PostLiquidityWithdrawalInput: Partial<PostLiquidityWithdrawalInput>;
  Query: {};
  Quote: Partial<Quote>;
  QuoteConnection: Partial<QuoteConnection>;
  QuoteEdge: Partial<QuoteEdge>;
  QuoteResponse: Partial<QuoteResponse>;
  Receiver: Partial<Receiver>;
  RevokeWalletAddressKeyInput: Partial<RevokeWalletAddressKeyInput>;
  RevokeWalletAddressKeyMutationResponse: Partial<RevokeWalletAddressKeyMutationResponse>;
  SetFeeInput: Partial<SetFeeInput>;
  SetFeeResponse: Partial<SetFeeResponse>;
  String: Partial<Scalars['String']['output']>;
  Tenant: Partial<Tenant>;
  TenantEdge: Partial<TenantEdge>;
  TenantMutationResponse: Partial<TenantMutationResponse>;
  TenantsConnection: Partial<TenantsConnection>;
  TriggerWalletAddressEventsInput: Partial<TriggerWalletAddressEventsInput>;
  TriggerWalletAddressEventsMutationResponse: Partial<TriggerWalletAddressEventsMutationResponse>;
  UInt8: Partial<Scalars['UInt8']['output']>;
  UInt64: Partial<Scalars['UInt64']['output']>;
  UpdateAssetInput: Partial<UpdateAssetInput>;
  UpdateIncomingPaymentInput: Partial<UpdateIncomingPaymentInput>;
  UpdatePeerInput: Partial<UpdatePeerInput>;
  UpdatePeerMutationResponse: Partial<UpdatePeerMutationResponse>;
  UpdateTenantInput: Partial<UpdateTenantInput>;
  UpdateWalletAddressInput: Partial<UpdateWalletAddressInput>;
  UpdateWalletAddressMutationResponse: Partial<UpdateWalletAddressMutationResponse>;
  VoidLiquidityWithdrawalInput: Partial<VoidLiquidityWithdrawalInput>;
  WalletAddress: Partial<WalletAddress>;
  WalletAddressEdge: Partial<WalletAddressEdge>;
  WalletAddressKey: Partial<WalletAddressKey>;
  WalletAddressKeyConnection: Partial<WalletAddressKeyConnection>;
  WalletAddressKeyEdge: Partial<WalletAddressKeyEdge>;
  WalletAddressWithdrawal: Partial<WalletAddressWithdrawal>;
  WalletAddressWithdrawalMutationResponse: Partial<WalletAddressWithdrawalMutationResponse>;
  WalletAddressesConnection: Partial<WalletAddressesConnection>;
  WebhookEvent: Partial<WebhookEvent>;
  WebhookEventFilter: Partial<WebhookEventFilter>;
  WebhookEventsConnection: Partial<WebhookEventsConnection>;
  WebhookEventsEdge: Partial<WebhookEventsEdge>;
  WhoamiResponse: Partial<WhoamiResponse>;
  WithdrawEventLiquidityInput: Partial<WithdrawEventLiquidityInput>;
};

export type AccountingTransferResolvers<ContextType = any, ParentType extends ResolversParentTypes['AccountingTransfer'] = ResolversParentTypes['AccountingTransfer']> = {
  amount?: Resolver<ResolversTypes['UInt64'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  creditAccountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  debitAccountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  expiresAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  ledger?: Resolver<ResolversTypes['UInt8'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['TransferState'], ParentType, ContextType>;
  transferType?: Resolver<ResolversTypes['TransferType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AccountingTransferConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['AccountingTransferConnection'] = ResolversParentTypes['AccountingTransferConnection']> = {
  credits?: Resolver<Array<ResolversTypes['AccountingTransfer']>, ParentType, ContextType>;
  debits?: Resolver<Array<ResolversTypes['AccountingTransfer']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AdditionalPropertyResolvers<ContextType = any, ParentType extends ResolversParentTypes['AdditionalProperty'] = ResolversParentTypes['AdditionalProperty']> = {
  key?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  visibleInOpenPayments?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AmountResolvers<ContextType = any, ParentType extends ResolversParentTypes['Amount'] = ResolversParentTypes['Amount']> = {
  assetCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  assetScale?: Resolver<ResolversTypes['UInt8'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['UInt64'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ApproveIncomingPaymentResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['ApproveIncomingPaymentResponse'] = ResolversParentTypes['ApproveIncomingPaymentResponse']> = {
  payment?: Resolver<Maybe<ResolversTypes['IncomingPayment']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AssetResolvers<ContextType = any, ParentType extends ResolversParentTypes['Asset'] = ResolversParentTypes['Asset']> = {
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fees?: Resolver<Maybe<ResolversTypes['FeesConnection']>, ParentType, ContextType, Partial<AssetFeesArgs>>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  liquidity?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  liquidityThreshold?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  receivingFee?: Resolver<Maybe<ResolversTypes['Fee']>, ParentType, ContextType>;
  scale?: Resolver<ResolversTypes['UInt8'], ParentType, ContextType>;
  sendingFee?: Resolver<Maybe<ResolversTypes['Fee']>, ParentType, ContextType>;
  withdrawalThreshold?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AssetEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['AssetEdge'] = ResolversParentTypes['AssetEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AssetMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['AssetMutationResponse'] = ResolversParentTypes['AssetMutationResponse']> = {
  asset?: Resolver<Maybe<ResolversTypes['Asset']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AssetsConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['AssetsConnection'] = ResolversParentTypes['AssetsConnection']> = {
  edges?: Resolver<Array<ResolversTypes['AssetEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type BasePaymentResolvers<ContextType = any, ParentType extends ResolversParentTypes['BasePayment'] = ResolversParentTypes['BasePayment']> = {
  __resolveType: TypeResolveFn<'IncomingPayment' | 'OutgoingPayment' | 'Payment', ParentType, ContextType>;
  client?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  walletAddressId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type CancelIncomingPaymentResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CancelIncomingPaymentResponse'] = ResolversParentTypes['CancelIncomingPaymentResponse']> = {
  payment?: Resolver<Maybe<ResolversTypes['IncomingPayment']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateOrUpdatePeerByUrlMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateOrUpdatePeerByUrlMutationResponse'] = ResolversParentTypes['CreateOrUpdatePeerByUrlMutationResponse']> = {
  peer?: Resolver<Maybe<ResolversTypes['Peer']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreatePeerMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreatePeerMutationResponse'] = ResolversParentTypes['CreatePeerMutationResponse']> = {
  peer?: Resolver<Maybe<ResolversTypes['Peer']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateReceiverResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateReceiverResponse'] = ResolversParentTypes['CreateReceiverResponse']> = {
  receiver?: Resolver<Maybe<ResolversTypes['Receiver']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateWalletAddressKeyMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateWalletAddressKeyMutationResponse'] = ResolversParentTypes['CreateWalletAddressKeyMutationResponse']> = {
  walletAddressKey?: Resolver<Maybe<ResolversTypes['WalletAddressKey']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateWalletAddressMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateWalletAddressMutationResponse'] = ResolversParentTypes['CreateWalletAddressMutationResponse']> = {
  walletAddress?: Resolver<Maybe<ResolversTypes['WalletAddress']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DeleteAssetMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['DeleteAssetMutationResponse'] = ResolversParentTypes['DeleteAssetMutationResponse']> = {
  asset?: Resolver<Maybe<ResolversTypes['Asset']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DeletePeerMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['DeletePeerMutationResponse'] = ResolversParentTypes['DeletePeerMutationResponse']> = {
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DeleteTenantMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['DeleteTenantMutationResponse'] = ResolversParentTypes['DeleteTenantMutationResponse']> = {
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeeResolvers<ContextType = any, ParentType extends ResolversParentTypes['Fee'] = ResolversParentTypes['Fee']> = {
  assetId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  basisPoints?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fixed?: Resolver<ResolversTypes['UInt64'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['FeeType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeeEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['FeeEdge'] = ResolversParentTypes['FeeEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Fee'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeesConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['FeesConnection'] = ResolversParentTypes['FeesConnection']> = {
  edges?: Resolver<Array<ResolversTypes['FeeEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HttpResolvers<ContextType = any, ParentType extends ResolversParentTypes['Http'] = ResolversParentTypes['Http']> = {
  outgoing?: Resolver<ResolversTypes['HttpOutgoing'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type HttpOutgoingResolvers<ContextType = any, ParentType extends ResolversParentTypes['HttpOutgoing'] = ResolversParentTypes['HttpOutgoing']> = {
  authToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endpoint?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IncomingPaymentResolvers<ContextType = any, ParentType extends ResolversParentTypes['IncomingPayment'] = ResolversParentTypes['IncomingPayment']> = {
  client?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  expiresAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  incomingAmount?: Resolver<Maybe<ResolversTypes['Amount']>, ParentType, ContextType>;
  liquidity?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  receivedAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['IncomingPaymentState'], ParentType, ContextType>;
  walletAddressId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IncomingPaymentConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['IncomingPaymentConnection'] = ResolversParentTypes['IncomingPaymentConnection']> = {
  edges?: Resolver<Array<ResolversTypes['IncomingPaymentEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IncomingPaymentEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['IncomingPaymentEdge'] = ResolversParentTypes['IncomingPaymentEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['IncomingPayment'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IncomingPaymentResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['IncomingPaymentResponse'] = ResolversParentTypes['IncomingPaymentResponse']> = {
  payment?: Resolver<Maybe<ResolversTypes['IncomingPayment']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type JwkResolvers<ContextType = any, ParentType extends ResolversParentTypes['Jwk'] = ResolversParentTypes['Jwk']> = {
  alg?: Resolver<ResolversTypes['Alg'], ParentType, ContextType>;
  crv?: Resolver<ResolversTypes['Crv'], ParentType, ContextType>;
  kid?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  kty?: Resolver<ResolversTypes['Kty'], ParentType, ContextType>;
  x?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LiquidityMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['LiquidityMutationResponse'] = ResolversParentTypes['LiquidityMutationResponse']> = {
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ModelResolvers<ContextType = any, ParentType extends ResolversParentTypes['Model'] = ResolversParentTypes['Model']> = {
  __resolveType: TypeResolveFn<'AccountingTransfer' | 'Asset' | 'Fee' | 'IncomingPayment' | 'OutgoingPayment' | 'Payment' | 'Peer' | 'Tenant' | 'WalletAddress' | 'WalletAddressKey' | 'WebhookEvent', ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  approveIncomingPayment?: Resolver<ResolversTypes['ApproveIncomingPaymentResponse'], ParentType, ContextType, RequireFields<MutationApproveIncomingPaymentArgs, 'input'>>;
  cancelIncomingPayment?: Resolver<ResolversTypes['CancelIncomingPaymentResponse'], ParentType, ContextType, RequireFields<MutationCancelIncomingPaymentArgs, 'input'>>;
  cancelOutgoingPayment?: Resolver<ResolversTypes['OutgoingPaymentResponse'], ParentType, ContextType, RequireFields<MutationCancelOutgoingPaymentArgs, 'input'>>;
  createAsset?: Resolver<ResolversTypes['AssetMutationResponse'], ParentType, ContextType, RequireFields<MutationCreateAssetArgs, 'input'>>;
  createAssetLiquidityWithdrawal?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationCreateAssetLiquidityWithdrawalArgs, 'input'>>;
  createIncomingPayment?: Resolver<ResolversTypes['IncomingPaymentResponse'], ParentType, ContextType, RequireFields<MutationCreateIncomingPaymentArgs, 'input'>>;
  createIncomingPaymentWithdrawal?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationCreateIncomingPaymentWithdrawalArgs, 'input'>>;
  createOrUpdatePeerByUrl?: Resolver<ResolversTypes['CreateOrUpdatePeerByUrlMutationResponse'], ParentType, ContextType, RequireFields<MutationCreateOrUpdatePeerByUrlArgs, 'input'>>;
  createOutgoingPayment?: Resolver<ResolversTypes['OutgoingPaymentResponse'], ParentType, ContextType, RequireFields<MutationCreateOutgoingPaymentArgs, 'input'>>;
  createOutgoingPaymentFromIncomingPayment?: Resolver<ResolversTypes['OutgoingPaymentResponse'], ParentType, ContextType, RequireFields<MutationCreateOutgoingPaymentFromIncomingPaymentArgs, 'input'>>;
  createOutgoingPaymentWithdrawal?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationCreateOutgoingPaymentWithdrawalArgs, 'input'>>;
  createPeer?: Resolver<ResolversTypes['CreatePeerMutationResponse'], ParentType, ContextType, RequireFields<MutationCreatePeerArgs, 'input'>>;
  createPeerLiquidityWithdrawal?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationCreatePeerLiquidityWithdrawalArgs, 'input'>>;
  createQuote?: Resolver<ResolversTypes['QuoteResponse'], ParentType, ContextType, RequireFields<MutationCreateQuoteArgs, 'input'>>;
  createReceiver?: Resolver<ResolversTypes['CreateReceiverResponse'], ParentType, ContextType, RequireFields<MutationCreateReceiverArgs, 'input'>>;
  createTenant?: Resolver<ResolversTypes['TenantMutationResponse'], ParentType, ContextType, RequireFields<MutationCreateTenantArgs, 'input'>>;
  createWalletAddress?: Resolver<ResolversTypes['CreateWalletAddressMutationResponse'], ParentType, ContextType, RequireFields<MutationCreateWalletAddressArgs, 'input'>>;
  createWalletAddressKey?: Resolver<Maybe<ResolversTypes['CreateWalletAddressKeyMutationResponse']>, ParentType, ContextType, RequireFields<MutationCreateWalletAddressKeyArgs, 'input'>>;
  createWalletAddressWithdrawal?: Resolver<Maybe<ResolversTypes['WalletAddressWithdrawalMutationResponse']>, ParentType, ContextType, RequireFields<MutationCreateWalletAddressWithdrawalArgs, 'input'>>;
  deleteAsset?: Resolver<ResolversTypes['DeleteAssetMutationResponse'], ParentType, ContextType, RequireFields<MutationDeleteAssetArgs, 'input'>>;
  deletePeer?: Resolver<ResolversTypes['DeletePeerMutationResponse'], ParentType, ContextType, RequireFields<MutationDeletePeerArgs, 'input'>>;
  deleteTenant?: Resolver<ResolversTypes['DeleteTenantMutationResponse'], ParentType, ContextType, RequireFields<MutationDeleteTenantArgs, 'id'>>;
  depositAssetLiquidity?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationDepositAssetLiquidityArgs, 'input'>>;
  depositEventLiquidity?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationDepositEventLiquidityArgs, 'input'>>;
  depositOutgoingPaymentLiquidity?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationDepositOutgoingPaymentLiquidityArgs, 'input'>>;
  depositPeerLiquidity?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationDepositPeerLiquidityArgs, 'input'>>;
  postLiquidityWithdrawal?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationPostLiquidityWithdrawalArgs, 'input'>>;
  revokeWalletAddressKey?: Resolver<Maybe<ResolversTypes['RevokeWalletAddressKeyMutationResponse']>, ParentType, ContextType, RequireFields<MutationRevokeWalletAddressKeyArgs, 'input'>>;
  setFee?: Resolver<ResolversTypes['SetFeeResponse'], ParentType, ContextType, RequireFields<MutationSetFeeArgs, 'input'>>;
  triggerWalletAddressEvents?: Resolver<ResolversTypes['TriggerWalletAddressEventsMutationResponse'], ParentType, ContextType, RequireFields<MutationTriggerWalletAddressEventsArgs, 'input'>>;
  updateAsset?: Resolver<ResolversTypes['AssetMutationResponse'], ParentType, ContextType, RequireFields<MutationUpdateAssetArgs, 'input'>>;
  updateIncomingPayment?: Resolver<ResolversTypes['IncomingPaymentResponse'], ParentType, ContextType, RequireFields<MutationUpdateIncomingPaymentArgs, 'input'>>;
  updatePeer?: Resolver<ResolversTypes['UpdatePeerMutationResponse'], ParentType, ContextType, RequireFields<MutationUpdatePeerArgs, 'input'>>;
  updateTenant?: Resolver<ResolversTypes['TenantMutationResponse'], ParentType, ContextType, RequireFields<MutationUpdateTenantArgs, 'input'>>;
  updateWalletAddress?: Resolver<ResolversTypes['UpdateWalletAddressMutationResponse'], ParentType, ContextType, RequireFields<MutationUpdateWalletAddressArgs, 'input'>>;
  voidLiquidityWithdrawal?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationVoidLiquidityWithdrawalArgs, 'input'>>;
  withdrawEventLiquidity?: Resolver<Maybe<ResolversTypes['LiquidityMutationResponse']>, ParentType, ContextType, RequireFields<MutationWithdrawEventLiquidityArgs, 'input'>>;
};

export type OutgoingPaymentResolvers<ContextType = any, ParentType extends ResolversParentTypes['OutgoingPayment'] = ResolversParentTypes['OutgoingPayment']> = {
  client?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  debitAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  error?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  grantId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  liquidity?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  quote?: Resolver<Maybe<ResolversTypes['Quote']>, ParentType, ContextType>;
  receiveAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  receiver?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sentAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['OutgoingPaymentState'], ParentType, ContextType>;
  stateAttempts?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  tenantId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  walletAddressId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type OutgoingPaymentConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['OutgoingPaymentConnection'] = ResolversParentTypes['OutgoingPaymentConnection']> = {
  edges?: Resolver<Array<ResolversTypes['OutgoingPaymentEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type OutgoingPaymentEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['OutgoingPaymentEdge'] = ResolversParentTypes['OutgoingPaymentEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['OutgoingPayment'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type OutgoingPaymentResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['OutgoingPaymentResponse'] = ResolversParentTypes['OutgoingPaymentResponse']> = {
  payment?: Resolver<Maybe<ResolversTypes['OutgoingPayment']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PaymentResolvers<ContextType = any, ParentType extends ResolversParentTypes['Payment'] = ResolversParentTypes['Payment']> = {
  client?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  liquidity?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  state?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['PaymentType'], ParentType, ContextType>;
  walletAddressId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PaymentConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['PaymentConnection'] = ResolversParentTypes['PaymentConnection']> = {
  edges?: Resolver<Array<ResolversTypes['PaymentEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PaymentEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['PaymentEdge'] = ResolversParentTypes['PaymentEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Payment'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeerResolvers<ContextType = any, ParentType extends ResolversParentTypes['Peer'] = ResolversParentTypes['Peer']> = {
  asset?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  http?: Resolver<ResolversTypes['Http'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  liquidity?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  liquidityThreshold?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  maxPacketAmount?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  staticIlpAddress?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeerEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['PeerEdge'] = ResolversParentTypes['PeerEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Peer'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PeersConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['PeersConnection'] = ResolversParentTypes['PeersConnection']> = {
  edges?: Resolver<Array<ResolversTypes['PeerEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  accountingTransfers?: Resolver<ResolversTypes['AccountingTransferConnection'], ParentType, ContextType, RequireFields<QueryAccountingTransfersArgs, 'id'>>;
  asset?: Resolver<Maybe<ResolversTypes['Asset']>, ParentType, ContextType, RequireFields<QueryAssetArgs, 'id'>>;
  assetByCodeAndScale?: Resolver<Maybe<ResolversTypes['Asset']>, ParentType, ContextType, RequireFields<QueryAssetByCodeAndScaleArgs, 'code' | 'scale'>>;
  assets?: Resolver<ResolversTypes['AssetsConnection'], ParentType, ContextType, Partial<QueryAssetsArgs>>;
  incomingPayment?: Resolver<Maybe<ResolversTypes['IncomingPayment']>, ParentType, ContextType, RequireFields<QueryIncomingPaymentArgs, 'id'>>;
  outgoingPayment?: Resolver<Maybe<ResolversTypes['OutgoingPayment']>, ParentType, ContextType, RequireFields<QueryOutgoingPaymentArgs, 'id'>>;
  outgoingPayments?: Resolver<ResolversTypes['OutgoingPaymentConnection'], ParentType, ContextType, Partial<QueryOutgoingPaymentsArgs>>;
  payments?: Resolver<ResolversTypes['PaymentConnection'], ParentType, ContextType, Partial<QueryPaymentsArgs>>;
  peer?: Resolver<Maybe<ResolversTypes['Peer']>, ParentType, ContextType, RequireFields<QueryPeerArgs, 'id'>>;
  peerByAddressAndAsset?: Resolver<Maybe<ResolversTypes['Peer']>, ParentType, ContextType, RequireFields<QueryPeerByAddressAndAssetArgs, 'assetId' | 'staticIlpAddress'>>;
  peers?: Resolver<ResolversTypes['PeersConnection'], ParentType, ContextType, Partial<QueryPeersArgs>>;
  quote?: Resolver<Maybe<ResolversTypes['Quote']>, ParentType, ContextType, RequireFields<QueryQuoteArgs, 'id'>>;
  receiver?: Resolver<Maybe<ResolversTypes['Receiver']>, ParentType, ContextType, RequireFields<QueryReceiverArgs, 'id'>>;
  tenant?: Resolver<ResolversTypes['Tenant'], ParentType, ContextType, RequireFields<QueryTenantArgs, 'id'>>;
  tenants?: Resolver<ResolversTypes['TenantsConnection'], ParentType, ContextType, Partial<QueryTenantsArgs>>;
  walletAddress?: Resolver<Maybe<ResolversTypes['WalletAddress']>, ParentType, ContextType, RequireFields<QueryWalletAddressArgs, 'id'>>;
  walletAddressByUrl?: Resolver<Maybe<ResolversTypes['WalletAddress']>, ParentType, ContextType, RequireFields<QueryWalletAddressByUrlArgs, 'url'>>;
  walletAddresses?: Resolver<ResolversTypes['WalletAddressesConnection'], ParentType, ContextType, Partial<QueryWalletAddressesArgs>>;
  webhookEvents?: Resolver<ResolversTypes['WebhookEventsConnection'], ParentType, ContextType, Partial<QueryWebhookEventsArgs>>;
  whoami?: Resolver<ResolversTypes['WhoamiResponse'], ParentType, ContextType>;
};

export type QuoteResolvers<ContextType = any, ParentType extends ResolversParentTypes['Quote'] = ResolversParentTypes['Quote']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  debitAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  estimatedExchangeRate?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  expiresAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  receiveAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  receiver?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tenantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  walletAddressId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuoteConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuoteConnection'] = ResolversParentTypes['QuoteConnection']> = {
  edges?: Resolver<Array<ResolversTypes['QuoteEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuoteEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuoteEdge'] = ResolversParentTypes['QuoteEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Quote'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuoteResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuoteResponse'] = ResolversParentTypes['QuoteResponse']> = {
  quote?: Resolver<Maybe<ResolversTypes['Quote']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ReceiverResolvers<ContextType = any, ParentType extends ResolversParentTypes['Receiver'] = ResolversParentTypes['Receiver']> = {
  completed?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  expiresAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  incomingAmount?: Resolver<Maybe<ResolversTypes['Amount']>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  receivedAmount?: Resolver<ResolversTypes['Amount'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  walletAddressUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type RevokeWalletAddressKeyMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['RevokeWalletAddressKeyMutationResponse'] = ResolversParentTypes['RevokeWalletAddressKeyMutationResponse']> = {
  walletAddressKey?: Resolver<Maybe<ResolversTypes['WalletAddressKey']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SetFeeResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['SetFeeResponse'] = ResolversParentTypes['SetFeeResponse']> = {
  fee?: Resolver<Maybe<ResolversTypes['Fee']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TenantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Tenant'] = ResolversParentTypes['Tenant']> = {
  apiSecret?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  idpConsentUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  idpSecret?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  publicName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TenantEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['TenantEdge'] = ResolversParentTypes['TenantEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Tenant'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TenantMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['TenantMutationResponse'] = ResolversParentTypes['TenantMutationResponse']> = {
  tenant?: Resolver<ResolversTypes['Tenant'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TenantsConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['TenantsConnection'] = ResolversParentTypes['TenantsConnection']> = {
  edges?: Resolver<Array<ResolversTypes['TenantEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TriggerWalletAddressEventsMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['TriggerWalletAddressEventsMutationResponse'] = ResolversParentTypes['TriggerWalletAddressEventsMutationResponse']> = {
  count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface UInt8ScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['UInt8'], any> {
  name: 'UInt8';
}

export interface UInt64ScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['UInt64'], any> {
  name: 'UInt64';
}

export type UpdatePeerMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['UpdatePeerMutationResponse'] = ResolversParentTypes['UpdatePeerMutationResponse']> = {
  peer?: Resolver<Maybe<ResolversTypes['Peer']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UpdateWalletAddressMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['UpdateWalletAddressMutationResponse'] = ResolversParentTypes['UpdateWalletAddressMutationResponse']> = {
  walletAddress?: Resolver<Maybe<ResolversTypes['WalletAddress']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddress'] = ResolversParentTypes['WalletAddress']> = {
  additionalProperties?: Resolver<Maybe<Array<Maybe<ResolversTypes['AdditionalProperty']>>>, ParentType, ContextType>;
  asset?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  incomingPayments?: Resolver<Maybe<ResolversTypes['IncomingPaymentConnection']>, ParentType, ContextType, Partial<WalletAddressIncomingPaymentsArgs>>;
  liquidity?: Resolver<Maybe<ResolversTypes['UInt64']>, ParentType, ContextType>;
  outgoingPayments?: Resolver<Maybe<ResolversTypes['OutgoingPaymentConnection']>, ParentType, ContextType, Partial<WalletAddressOutgoingPaymentsArgs>>;
  publicName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  quotes?: Resolver<Maybe<ResolversTypes['QuoteConnection']>, ParentType, ContextType, Partial<WalletAddressQuotesArgs>>;
  status?: Resolver<ResolversTypes['WalletAddressStatus'], ParentType, ContextType>;
  tenantId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  walletAddressKeys?: Resolver<Maybe<ResolversTypes['WalletAddressKeyConnection']>, ParentType, ContextType, Partial<WalletAddressWalletAddressKeysArgs>>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressEdge'] = ResolversParentTypes['WalletAddressEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['WalletAddress'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressKeyResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressKey'] = ResolversParentTypes['WalletAddressKey']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  jwk?: Resolver<ResolversTypes['Jwk'], ParentType, ContextType>;
  revoked?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  walletAddressId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressKeyConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressKeyConnection'] = ResolversParentTypes['WalletAddressKeyConnection']> = {
  edges?: Resolver<Array<ResolversTypes['WalletAddressKeyEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressKeyEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressKeyEdge'] = ResolversParentTypes['WalletAddressKeyEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['WalletAddressKey'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressWithdrawalResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressWithdrawal'] = ResolversParentTypes['WalletAddressWithdrawal']> = {
  amount?: Resolver<ResolversTypes['UInt64'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  walletAddress?: Resolver<ResolversTypes['WalletAddress'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressWithdrawalMutationResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressWithdrawalMutationResponse'] = ResolversParentTypes['WalletAddressWithdrawalMutationResponse']> = {
  withdrawal?: Resolver<Maybe<ResolversTypes['WalletAddressWithdrawal']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WalletAddressesConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['WalletAddressesConnection'] = ResolversParentTypes['WalletAddressesConnection']> = {
  edges?: Resolver<Array<ResolversTypes['WalletAddressEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WebhookEventResolvers<ContextType = any, ParentType extends ResolversParentTypes['WebhookEvent'] = ResolversParentTypes['WebhookEvent']> = {
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  data?: Resolver<ResolversTypes['JSONObject'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WebhookEventsConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['WebhookEventsConnection'] = ResolversParentTypes['WebhookEventsConnection']> = {
  edges?: Resolver<Array<ResolversTypes['WebhookEventsEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WebhookEventsEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['WebhookEventsEdge'] = ResolversParentTypes['WebhookEventsEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['WebhookEvent'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WhoamiResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['WhoamiResponse'] = ResolversParentTypes['WhoamiResponse']> = {
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isOperator?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  AccountingTransfer?: AccountingTransferResolvers<ContextType>;
  AccountingTransferConnection?: AccountingTransferConnectionResolvers<ContextType>;
  AdditionalProperty?: AdditionalPropertyResolvers<ContextType>;
  Amount?: AmountResolvers<ContextType>;
  ApproveIncomingPaymentResponse?: ApproveIncomingPaymentResponseResolvers<ContextType>;
  Asset?: AssetResolvers<ContextType>;
  AssetEdge?: AssetEdgeResolvers<ContextType>;
  AssetMutationResponse?: AssetMutationResponseResolvers<ContextType>;
  AssetsConnection?: AssetsConnectionResolvers<ContextType>;
  BasePayment?: BasePaymentResolvers<ContextType>;
  CancelIncomingPaymentResponse?: CancelIncomingPaymentResponseResolvers<ContextType>;
  CreateOrUpdatePeerByUrlMutationResponse?: CreateOrUpdatePeerByUrlMutationResponseResolvers<ContextType>;
  CreatePeerMutationResponse?: CreatePeerMutationResponseResolvers<ContextType>;
  CreateReceiverResponse?: CreateReceiverResponseResolvers<ContextType>;
  CreateWalletAddressKeyMutationResponse?: CreateWalletAddressKeyMutationResponseResolvers<ContextType>;
  CreateWalletAddressMutationResponse?: CreateWalletAddressMutationResponseResolvers<ContextType>;
  DeleteAssetMutationResponse?: DeleteAssetMutationResponseResolvers<ContextType>;
  DeletePeerMutationResponse?: DeletePeerMutationResponseResolvers<ContextType>;
  DeleteTenantMutationResponse?: DeleteTenantMutationResponseResolvers<ContextType>;
  Fee?: FeeResolvers<ContextType>;
  FeeEdge?: FeeEdgeResolvers<ContextType>;
  FeesConnection?: FeesConnectionResolvers<ContextType>;
  Http?: HttpResolvers<ContextType>;
  HttpOutgoing?: HttpOutgoingResolvers<ContextType>;
  IncomingPayment?: IncomingPaymentResolvers<ContextType>;
  IncomingPaymentConnection?: IncomingPaymentConnectionResolvers<ContextType>;
  IncomingPaymentEdge?: IncomingPaymentEdgeResolvers<ContextType>;
  IncomingPaymentResponse?: IncomingPaymentResponseResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  Jwk?: JwkResolvers<ContextType>;
  LiquidityMutationResponse?: LiquidityMutationResponseResolvers<ContextType>;
  Model?: ModelResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  OutgoingPayment?: OutgoingPaymentResolvers<ContextType>;
  OutgoingPaymentConnection?: OutgoingPaymentConnectionResolvers<ContextType>;
  OutgoingPaymentEdge?: OutgoingPaymentEdgeResolvers<ContextType>;
  OutgoingPaymentResponse?: OutgoingPaymentResponseResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Payment?: PaymentResolvers<ContextType>;
  PaymentConnection?: PaymentConnectionResolvers<ContextType>;
  PaymentEdge?: PaymentEdgeResolvers<ContextType>;
  Peer?: PeerResolvers<ContextType>;
  PeerEdge?: PeerEdgeResolvers<ContextType>;
  PeersConnection?: PeersConnectionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Quote?: QuoteResolvers<ContextType>;
  QuoteConnection?: QuoteConnectionResolvers<ContextType>;
  QuoteEdge?: QuoteEdgeResolvers<ContextType>;
  QuoteResponse?: QuoteResponseResolvers<ContextType>;
  Receiver?: ReceiverResolvers<ContextType>;
  RevokeWalletAddressKeyMutationResponse?: RevokeWalletAddressKeyMutationResponseResolvers<ContextType>;
  SetFeeResponse?: SetFeeResponseResolvers<ContextType>;
  Tenant?: TenantResolvers<ContextType>;
  TenantEdge?: TenantEdgeResolvers<ContextType>;
  TenantMutationResponse?: TenantMutationResponseResolvers<ContextType>;
  TenantsConnection?: TenantsConnectionResolvers<ContextType>;
  TriggerWalletAddressEventsMutationResponse?: TriggerWalletAddressEventsMutationResponseResolvers<ContextType>;
  UInt8?: GraphQLScalarType;
  UInt64?: GraphQLScalarType;
  UpdatePeerMutationResponse?: UpdatePeerMutationResponseResolvers<ContextType>;
  UpdateWalletAddressMutationResponse?: UpdateWalletAddressMutationResponseResolvers<ContextType>;
  WalletAddress?: WalletAddressResolvers<ContextType>;
  WalletAddressEdge?: WalletAddressEdgeResolvers<ContextType>;
  WalletAddressKey?: WalletAddressKeyResolvers<ContextType>;
  WalletAddressKeyConnection?: WalletAddressKeyConnectionResolvers<ContextType>;
  WalletAddressKeyEdge?: WalletAddressKeyEdgeResolvers<ContextType>;
  WalletAddressWithdrawal?: WalletAddressWithdrawalResolvers<ContextType>;
  WalletAddressWithdrawalMutationResponse?: WalletAddressWithdrawalMutationResponseResolvers<ContextType>;
  WalletAddressesConnection?: WalletAddressesConnectionResolvers<ContextType>;
  WebhookEvent?: WebhookEventResolvers<ContextType>;
  WebhookEventsConnection?: WebhookEventsConnectionResolvers<ContextType>;
  WebhookEventsEdge?: WebhookEventsEdgeResolvers<ContextType>;
  WhoamiResponse?: WhoamiResponseResolvers<ContextType>;
};


export type GetAssetQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetAssetQuery = { __typename?: 'Query', asset?: { __typename?: 'Asset', id: string, code: string, scale: number, withdrawalThreshold?: bigint | null, liquidity?: bigint | null, createdAt: string, sendingFee?: { __typename?: 'Fee', basisPoints: number, fixed: bigint, createdAt: string } | null } | null };

export type GetAssetWithFeesQueryVariables = Exact<{
  id: Scalars['String']['input'];
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAssetWithFeesQuery = { __typename?: 'Query', asset?: { __typename?: 'Asset', fees?: { __typename?: 'FeesConnection', edges: Array<{ __typename?: 'FeeEdge', cursor: string, node: { __typename?: 'Fee', assetId: string, basisPoints: number, createdAt: string, fixed: bigint, id: string, type: FeeType } }>, pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: string | null } } | null } | null };

export type ListAssetsQueryVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ListAssetsQuery = { __typename?: 'Query', assets: { __typename?: 'AssetsConnection', edges: Array<{ __typename?: 'AssetEdge', node: { __typename?: 'Asset', code: string, id: string, scale: number, withdrawalThreshold?: bigint | null, createdAt: string } }>, pageInfo: { __typename?: 'PageInfo', startCursor?: string | null, endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type CreateAssetMutationVariables = Exact<{
  input: CreateAssetInput;
}>;


export type CreateAssetMutation = { __typename?: 'Mutation', createAsset: { __typename?: 'AssetMutationResponse', asset?: { __typename?: 'Asset', id: string, code: string, scale: number, withdrawalThreshold?: bigint | null, liquidity?: bigint | null, createdAt: string, sendingFee?: { __typename?: 'Fee', basisPoints: number, fixed: bigint, createdAt: string } | null } | null } };

export type UpdateAssetMutationVariables = Exact<{
  input: UpdateAssetInput;
}>;


export type UpdateAssetMutation = { __typename?: 'Mutation', updateAsset: { __typename?: 'AssetMutationResponse', asset?: { __typename?: 'Asset', id: string, code: string, scale: number, withdrawalThreshold?: bigint | null, liquidity?: bigint | null, createdAt: string, sendingFee?: { __typename?: 'Fee', basisPoints: number, fixed: bigint, createdAt: string } | null } | null } };

export type SetFeeMutationVariables = Exact<{
  input: SetFeeInput;
}>;


export type SetFeeMutation = { __typename?: 'Mutation', setFee: { __typename?: 'SetFeeResponse', fee?: { __typename?: 'Fee', assetId: string, basisPoints: number, createdAt: string, fixed: bigint, id: string, type: FeeType } | null } };

export type DepositAssetLiquidityMutationVariables = Exact<{
  input: DepositAssetLiquidityInput;
}>;


export type DepositAssetLiquidityMutation = { __typename?: 'Mutation', depositAssetLiquidity?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type WithdrawAssetLiquidityVariables = Exact<{
  input: CreateAssetLiquidityWithdrawalInput;
}>;


export type WithdrawAssetLiquidity = { __typename?: 'Mutation', createAssetLiquidityWithdrawal?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type DeleteAssetMutationVariables = Exact<{
  input: DeleteAssetInput;
}>;


export type DeleteAssetMutation = { __typename?: 'Mutation', deleteAsset: { __typename?: 'DeleteAssetMutationResponse', asset?: { __typename?: 'Asset', id: string, code: string, scale: number, withdrawalThreshold?: bigint | null, liquidity?: bigint | null, createdAt: string, sendingFee?: { __typename?: 'Fee', basisPoints: number, fixed: bigint, createdAt: string } | null } | null } };

export type GetIncomingPaymentVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetIncomingPayment = { __typename?: 'Query', incomingPayment?: { __typename?: 'IncomingPayment', id: string, walletAddressId: string, state: IncomingPaymentState, expiresAt: string, metadata?: any | null, createdAt: string, liquidity?: bigint | null, incomingAmount?: { __typename?: 'Amount', value: bigint, assetCode: string, assetScale: number } | null, receivedAmount: { __typename?: 'Amount', value: bigint, assetCode: string, assetScale: number } } | null };

export type GetOutgoingPaymentVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetOutgoingPayment = { __typename?: 'Query', outgoingPayment?: { __typename?: 'OutgoingPayment', id: string, createdAt: string, error?: string | null, receiver: string, walletAddressId: string, state: OutgoingPaymentState, metadata?: any | null, liquidity?: bigint | null, receiveAmount: { __typename?: 'Amount', assetCode: string, assetScale: number, value: bigint }, debitAmount: { __typename?: 'Amount', assetCode: string, assetScale: number, value: bigint }, sentAmount: { __typename?: 'Amount', assetCode: string, assetScale: number, value: bigint } } | null };

export type ListPaymentsQueryVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<PaymentFilter>;
}>;


export type ListPaymentsQuery = { __typename?: 'Query', payments: { __typename?: 'PaymentConnection', edges: Array<{ __typename?: 'PaymentEdge', node: { __typename?: 'Payment', id: string, type: PaymentType, state: string, createdAt: string } }>, pageInfo: { __typename?: 'PageInfo', startCursor?: string | null, endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type DepositOutgoingPaymentLiquidityVariables = Exact<{
  input: DepositOutgoingPaymentLiquidityInput;
}>;


export type DepositOutgoingPaymentLiquidity = { __typename?: 'Mutation', depositOutgoingPaymentLiquidity?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type CreateOutgoingPaymentWithdrawalVariables = Exact<{
  input: CreateOutgoingPaymentWithdrawalInput;
}>;


export type CreateOutgoingPaymentWithdrawal = { __typename?: 'Mutation', createOutgoingPaymentWithdrawal?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type CreateIncomingPaymentWithdrawalVariables = Exact<{
  input: CreateIncomingPaymentWithdrawalInput;
}>;


export type CreateIncomingPaymentWithdrawal = { __typename?: 'Mutation', createIncomingPaymentWithdrawal?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type GetPeerQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPeerQuery = { __typename?: 'Query', peer?: { __typename?: 'Peer', id: string, name?: string | null, staticIlpAddress: string, maxPacketAmount?: bigint | null, liquidity?: bigint | null, createdAt: string, asset: { __typename?: 'Asset', id: string, code: string, scale: number, withdrawalThreshold?: bigint | null }, http: { __typename?: 'Http', outgoing: { __typename?: 'HttpOutgoing', endpoint: string, authToken: string } } } | null };

export type ListPeersQueryVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ListPeersQuery = { __typename?: 'Query', peers: { __typename?: 'PeersConnection', edges: Array<{ __typename?: 'PeerEdge', node: { __typename?: 'Peer', id: string, name?: string | null, staticIlpAddress: string, http: { __typename?: 'Http', outgoing: { __typename?: 'HttpOutgoing', endpoint: string } }, asset: { __typename?: 'Asset', code: string, scale: number } } }>, pageInfo: { __typename?: 'PageInfo', startCursor?: string | null, endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type CreatePeerMutationVariables = Exact<{
  input: CreatePeerInput;
}>;


export type CreatePeerMutation = { __typename?: 'Mutation', createPeer: { __typename?: 'CreatePeerMutationResponse', peer?: { __typename?: 'Peer', id: string } | null } };

export type UpdatePeerMutationVariables = Exact<{
  input: UpdatePeerInput;
}>;


export type UpdatePeerMutation = { __typename?: 'Mutation', updatePeer: { __typename?: 'UpdatePeerMutationResponse', peer?: { __typename?: 'Peer', id: string } | null } };

export type DeletePeerMutationVariables = Exact<{
  input: DeletePeerInput;
}>;


export type DeletePeerMutation = { __typename?: 'Mutation', deletePeer: { __typename?: 'DeletePeerMutationResponse', success: boolean } };

export type DepositPeerLiquidityMutationVariables = Exact<{
  input: DepositPeerLiquidityInput;
}>;


export type DepositPeerLiquidityMutation = { __typename?: 'Mutation', depositPeerLiquidity?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type WithdrawPeerLiquidityVariables = Exact<{
  input: CreatePeerLiquidityWithdrawalInput;
}>;


export type WithdrawPeerLiquidity = { __typename?: 'Mutation', createPeerLiquidityWithdrawal?: { __typename?: 'LiquidityMutationResponse', success: boolean } | null };

export type ListTenantsQueryVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ListTenantsQuery = { __typename?: 'Query', tenants: { __typename?: 'TenantsConnection', edges: Array<{ __typename?: 'TenantEdge', node: { __typename?: 'Tenant', id: string, email?: string | null, apiSecret: string, idpConsentUrl?: string | null, idpSecret?: string | null, publicName?: string | null, createdAt: string, deletedAt?: string | null } }>, pageInfo: { __typename?: 'PageInfo', startCursor?: string | null, endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type CreateTenantMutationVariables = Exact<{
  input: CreateTenantInput;
}>;


export type CreateTenantMutation = { __typename?: 'Mutation', createTenant: { __typename?: 'TenantMutationResponse', tenant: { __typename?: 'Tenant', id: string, publicName?: string | null, email?: string | null, apiSecret: string, idpConsentUrl?: string | null, idpSecret?: string | null } } };

export type UpdateTenantMutationVariables = Exact<{
  input: UpdateTenantInput;
}>;


export type UpdateTenantMutation = { __typename?: 'Mutation', updateTenant: { __typename?: 'TenantMutationResponse', tenant: { __typename?: 'Tenant', id: string, email?: string | null, apiSecret: string, idpConsentUrl?: string | null, idpSecret?: string | null, publicName?: string | null } } };

export type DeleteTenantMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteTenantMutation = { __typename?: 'Mutation', deleteTenant: { __typename?: 'DeleteTenantMutationResponse', success: boolean } };

export type GetTenantQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetTenantQuery = { __typename?: 'Query', tenant: { __typename?: 'Tenant', id: string, email?: string | null, apiSecret: string, idpConsentUrl?: string | null, idpSecret?: string | null, publicName?: string | null, createdAt: string, deletedAt?: string | null } };

export type WhoAmIQueryVariables = Exact<{ [key: string]: never; }>;


export type WhoAmIQuery = { __typename?: 'Query', whoami: { __typename?: 'WhoamiResponse', id: string, isOperator: boolean } };

export type GetWalletAddressQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetWalletAddressQuery = { __typename?: 'Query', walletAddress?: { __typename?: 'WalletAddress', id: string, url: string, publicName?: string | null, status: WalletAddressStatus, createdAt: string, liquidity?: bigint | null, asset: { __typename?: 'Asset', id: string, code: string, scale: number, withdrawalThreshold?: bigint | null } } | null };

export type ListWalletAddresssQueryVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ListWalletAddresssQuery = { __typename?: 'Query', walletAddresses: { __typename?: 'WalletAddressesConnection', edges: Array<{ __typename?: 'WalletAddressEdge', cursor: string, node: { __typename?: 'WalletAddress', id: string, publicName?: string | null, status: WalletAddressStatus, url: string } }>, pageInfo: { __typename?: 'PageInfo', startCursor?: string | null, endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean } } };

export type UpdateWalletAddressMutationVariables = Exact<{
  input: UpdateWalletAddressInput;
}>;


export type UpdateWalletAddressMutation = { __typename?: 'Mutation', updateWalletAddress: { __typename?: 'UpdateWalletAddressMutationResponse', walletAddress?: { __typename?: 'WalletAddress', id: string } | null } };

export type CreateWalletAddressMutationVariables = Exact<{
  input: CreateWalletAddressInput;
}>;


export type CreateWalletAddressMutation = { __typename?: 'Mutation', createWalletAddress: { __typename?: 'CreateWalletAddressMutationResponse', walletAddress?: { __typename?: 'WalletAddress', id: string } | null } };

export type CreateWalletAddressWithdrawalVariables = Exact<{
  input: CreateWalletAddressWithdrawalInput;
}>;


export type CreateWalletAddressWithdrawal = { __typename?: 'Mutation', createWalletAddressWithdrawal?: { __typename?: 'WalletAddressWithdrawalMutationResponse', withdrawal?: { __typename?: 'WalletAddressWithdrawal', id: string } | null } | null };

export type ListWebhookEventsVariables = Exact<{
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<WebhookEventFilter>;
}>;


export type ListWebhookEvents = { __typename?: 'Query', webhookEvents: { __typename?: 'WebhookEventsConnection', edges: Array<{ __typename?: 'WebhookEventsEdge', cursor: string, node: { __typename?: 'WebhookEvent', id: string, data: any, type: string, createdAt: string } }>, pageInfo: { __typename?: 'PageInfo', startCursor?: string | null, endCursor?: string | null, hasNextPage: boolean, hasPreviousPage: boolean } } };
