import assert from 'assert'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { createTestApp, TestContainer } from '../tests/app'
import { truncateTables } from '../tests/tableManager'
import { Config } from '../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../'
import { AppServices } from '../app'
import { GrantService, GrantRequest } from '../grant/service'
import { Grant, StartMethod, FinishMethod, GrantState } from '../grant/model'
import { Action, AccessType } from '../access/types'
import { Access } from '../access/model'
import { generateNonce, generateToken } from '../shared/utils'

describe('Grant Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let grantService: GrantService
  let knex: Knex
  let trx: Knex.Transaction

  let grant: Grant

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    grantService = await deps.use('grantService')
    knex = await deps.use('knex')
    appContainer = await createTestApp(deps)
  })

  const CLIENT = faker.internet.url()
  const CLIENT_KEY_ID = v4()

  beforeEach(async (): Promise<void> => {
    grant = await Grant.query().insert({
      state: GrantState.Pending,
      startMethod: [StartMethod.Redirect],
      continueToken: generateToken(),
      continueId: v4(),
      finishMethod: FinishMethod.Redirect,
      finishUri: 'https://example.com',
      clientNonce: generateNonce(),
      client: CLIENT,
      clientKeyId: CLIENT_KEY_ID,
      interactId: v4(),
      interactRef: v4(),
      interactNonce: generateNonce()
    })

    await Access.query().insert({
      ...BASE_GRANT_ACCESS,
      type: AccessType.IncomingPayment,
      grantId: grant.id
    })
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  const BASE_GRANT_ACCESS = {
    actions: [Action.Create, Action.Read, Action.List],
    identifier: `https://example.com/${v4()}`
  }

  const BASE_GRANT_REQUEST = {
    client: CLIENT,
    interact: {
      start: [StartMethod.Redirect],
      finish: {
        method: FinishMethod.Redirect,
        uri: 'https://example.com/finish',
        nonce: generateNonce()
      }
    }
  }

  describe('create', (): void => {
    test('Can initiate a grant', async (): Promise<void> => {
      const grantRequest: GrantRequest = {
        ...BASE_GRANT_REQUEST,
        clientKeyId: CLIENT_KEY_ID,
        access_token: {
          access: [
            {
              ...BASE_GRANT_ACCESS,
              type: AccessType.IncomingPayment
            }
          ]
        }
      }

      const grant = await grantService.create(grantRequest)

      expect(grant).toMatchObject({
        state: GrantState.Pending,
        continueId: expect.any(String),
        continueToken: expect.any(String),
        interactRef: expect.any(String),
        interactId: expect.any(String),
        interactNonce: expect.any(String),
        finishMethod: FinishMethod.Redirect,
        finishUri: BASE_GRANT_REQUEST.interact.finish.uri,
        clientNonce: BASE_GRANT_REQUEST.interact.finish.nonce,
        client: CLIENT,
        clientKeyId: CLIENT_KEY_ID,
        startMethod: expect.arrayContaining([StartMethod.Redirect])
      })

      await expect(
        Access.query(trx)
          .where({
            grantId: grant.id
          })
          .first()
      ).resolves.toMatchObject({
        type: AccessType.IncomingPayment
      })
    })
    test('Can issue a grant without interaction', async (): Promise<void> => {
      const grantRequest: GrantRequest = {
        ...BASE_GRANT_REQUEST,
        clientKeyId: CLIENT_KEY_ID,
        access_token: {
          access: [
            {
              ...BASE_GRANT_ACCESS,
              type: AccessType.IncomingPayment
            }
          ]
        },
        interact: undefined
      }

      const grant = await grantService.create(grantRequest)

      expect(grant).toMatchObject({
        state: GrantState.Granted,
        continueId: expect.any(String),
        continueToken: expect.any(String),
        clientKeyId: CLIENT_KEY_ID
      })

      await expect(
        Access.query(trx)
          .where({
            grantId: grant.id
          })
          .first()
      ).resolves.toMatchObject({
        type: AccessType.IncomingPayment
      })
    })
  })

  describe('issue', (): void => {
    test('Can issue a grant', async (): Promise<void> => {
      const issuedGrant = await grantService.issueGrant(grant.id)
      expect(issuedGrant.state).toEqual(GrantState.Granted)
    })
  })

  describe('continue', (): void => {
    test('Can fetch a grant by its continuation information', async (): Promise<void> => {
      const { continueId, continueToken, interactRef } = grant
      assert.ok(interactRef)

      const fetchedGrant = await grantService.getByContinue(
        continueId,
        continueToken,
        interactRef
      )
      expect(fetchedGrant?.id).toEqual(grant.id)
      expect(fetchedGrant?.continueId).toEqual(continueId)
      expect(fetchedGrant?.continueToken).toEqual(continueToken)
      expect(fetchedGrant?.interactRef).toEqual(interactRef)
    })
  })

  describe('get', (): void => {
    test('Can fetch a grant by id', async () => {
      const fetchedGrant = await grantService.get(grant.id)
      expect(fetchedGrant?.id).toEqual(grant.id)
    })
    test('Can fetch a grant by its interaction information', async (): Promise<void> => {
      assert.ok(grant.interactId)
      const fetchedGrant = await grantService.getByInteraction(grant.interactId)
      expect(fetchedGrant?.id).toEqual(grant.id)
      expect(fetchedGrant?.interactId).toEqual(grant.interactId)
    })
  })

  describe('reject', (): void => {
    test('Can reject a grant', async (): Promise<void> => {
      const rejectedGrant = await grantService.rejectGrant(grant.id)
      expect(rejectedGrant?.id).toEqual(grant.id)
      expect(rejectedGrant?.state).toEqual(GrantState.Rejected)
    })

    test("Cannot reject a grant that doesn't exist", async (): Promise<void> => {
      const rejectedGrant = await grantService.rejectGrant(v4())
      expect(rejectedGrant).toBeUndefined()
    })
  })

  describe('delete', (): void => {
    test('Can delete a grant', async (): Promise<void> => {
      await expect(grantService.deleteGrant(grant.continueId)).resolves.toEqual(
        true
      )
      await expect(grantService.get(grant.id)).resolves.toBeUndefined()
    })

    test('Can "delete" unknown grant', async (): Promise<void> => {
      await expect(grantService.deleteGrant(v4())).resolves.toEqual(false)
    })
  })
})
