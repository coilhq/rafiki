import { gql } from 'apollo-server-koa'
import Knex from 'knex'

import { createTestApp, TestContainer } from '../../tests/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { initIocContainer } from '../..'
import { Config } from '../../config/app'
import { truncateTables } from '../../tests/tableManager'
import { AccountService } from '../../account/service'
import { AccountFactory } from '../../tests/accountFactory'
import {
  CreateApiKeyInput,
  CreateApiKeyMutationResponse,
  DeleteAllApiKeysInput,
  DeleteAllApiKeysMutationResponse,
  RedeemSessionKeyInput,
  RedeemSessionKeyMutationResponse
} from '../generated/graphql'
import { ApiKeyService } from '../../apiKey/service'
import bcrypt from 'bcrypt'
import { SessionKeyService } from '../../sessionKey/service'

describe('ApiKey Resolvers', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let knex: Knex
  let accountService: AccountService
  let accountFactory: AccountFactory
  let apiKeyService: ApiKeyService
  let sessionKeyService: SessionKeyService

  beforeAll(
    async (): Promise<void> => {
      deps = await initIocContainer(Config)
      appContainer = await createTestApp(deps)
      knex = await deps.use('knex')
      accountService = await deps.use('accountService')
      accountFactory = new AccountFactory(accountService)
      apiKeyService = await deps.use('apiKeyService')
      sessionKeyService = await deps.use('sessionKeyService')
    }
  )

  afterEach(
    async (): Promise<void> => {
      await truncateTables(knex)
    }
  )

  afterAll(
    async (): Promise<void> => {
      await appContainer.apolloClient.stop()
      await appContainer.shutdown()
    }
  )

  describe('Api Key Mutations', (): void => {
    test('Api key can be created', async (): Promise<void> => {
      const { id: accountId } = await accountFactory.build()
      const input: CreateApiKeyInput = { accountId }
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation CreateApiKey($input: CreateApiKeyInput!) {
              createApiKey(input: $input) {
                code
                success
                message
                apiKey {
                  id
                  accountId
                  key
                  createdAt
                  updatedAt
                }
              }
            }
          `,
          variables: {
            input
          }
        })
        .then(
          (query): CreateApiKeyMutationResponse => {
            if (query.data) {
              return query.data.createApiKey
            } else {
              throw new Error('Data was empty')
            }
          }
        )

      expect(response.success).toBe(true)
      expect(response.code).toEqual('200')
      expect(response.apiKey?.id).not.toBeNull()
      expect(response.apiKey?.accountId).not.toBeNull()
      expect(response.apiKey?.key).not.toBeNull()
      expect(response.apiKey?.createdAt).not.toBeNull()
      expect(response.apiKey?.updatedAt).not.toBeNull()
      if (response.apiKey) {
        const apiKeys = await apiKeyService.get(input)
        expect(response.apiKey.id).toEqual(apiKeys[0].id)
        expect(response.apiKey.accountId).toEqual(apiKeys[0].accountId)
        expect(response.apiKey.createdAt).toEqual(
          new Date(apiKeys[0].createdAt).toISOString()
        )
        expect(response.apiKey.updatedAt).toEqual(
          new Date(apiKeys[0].updatedAt).toISOString()
        )
        await expect(
          bcrypt.compare(response.apiKey.key, apiKeys[0].hashedKey)
        ).resolves.toBe(true)
      } else {
        fail()
      }
    })

    test('Session Key can be redeemed', async (): Promise<void> => {
      const { id: accountId } = await accountFactory.build()
      const apiKey = await apiKeyService.create({ accountId })
      const input: RedeemSessionKeyInput = {
        accountId,
        key: apiKey.key
      }
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation RedeemSessionKey($input: RedeemSessionKeyInput!) {
              redeemSessionKey(input: $input) {
                code
                success
                message
                session {
                  key
                  expiresAt
                }
              }
            }
          `,
          variables: {
            input
          }
        })
        .then(
          (query): RedeemSessionKeyMutationResponse => {
            if (query.data) {
              return query.data.redeemSessionKey
            } else {
              throw new Error('Data was empty')
            }
          }
        )

      expect(response.success).toBe(true)
      expect(response.code).toEqual('200')
      expect(response.session?.key).not.toBeNull()
      expect(response.session?.expiresAt).not.toBeNull()
      if (response.session) {
        const session = await sessionKeyService.getSession(response.session.key)
        expect(new Date(Number(response.session.expiresAt))).toEqual(
          session.expiresAt
        )
      } else {
        fail()
      }
    })

    test('Api keys can be deleted', async (): Promise<void> => {
      const { id: accountId } = await accountFactory.build()
      await apiKeyService.create({ accountId })
      const input: DeleteAllApiKeysInput = { accountId }
      const response = await appContainer.apolloClient
        .mutate({
          mutation: gql`
            mutation DeleteAllApiKeys($input: DeleteAllApiKeysInput!) {
              deleteAllApiKeys(input: $input) {
                code
                success
                message
              }
            }
          `,
          variables: {
            input
          }
        })
        .then(
          (query): DeleteAllApiKeysMutationResponse => {
            if (query.data) {
              return query.data.deleteAllApiKeys
            } else {
              throw new Error('Data was empty')
            }
          }
        )

      expect(response.success).toBe(true)
      expect(response.code).toEqual('200')
    })
  })
})
