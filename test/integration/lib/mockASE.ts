import { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import {
  AuthenticatedClient,
  createAuthenticatedClient
} from '@interledger/open-payments'
import { AccountProvider, setupFromSeed } from 'mock-account-service-lib'
import { createApolloClient } from './apolloClient'
import { AdminClient } from './adminClient'
import { IntegrationServer } from './integrationServer'
import { TestConfig } from './config'

/** Mock Account Servicing Entity */
export class MockASE {
  private config: TestConfig
  private apolloClient: ApolloClient<NormalizedCacheObject>

  public adminClient: AdminClient
  public accounts: AccountProvider
  public opClient!: AuthenticatedClient
  public integrationServer: IntegrationServer

  // Use .create factory because async construction
  public static async create(config: TestConfig): Promise<MockASE> {
    const mase = new MockASE(config)
    await mase.initAsync()
    return mase
  }

  // Private to ensure it doesnt get called directly.
  // Use static MockASE.create instead.
  private constructor(config: TestConfig) {
    this.config = config
    this.apolloClient = createApolloClient(config.graphqlUrl)
    this.adminClient = new AdminClient(this.apolloClient)
    this.accounts = new AccountProvider()
    this.integrationServer = new IntegrationServer(
      this.config,
      this.adminClient,
      this.accounts
    )
    this.integrationServer.start(this.config.integrationServerPort)
  }

  private async initAsync() {
    await setupFromSeed(this.config, this.apolloClient, this.accounts)

    this.opClient = await createAuthenticatedClient({
      privateKey: this.config.key,
      keyId: this.config.keyId,
      walletAddressUrl: this.config.walletAddressUrl,
      useHttp: true
    })
  }

  public async shutdown() {
    await this.integrationServer.close()
  }
}
