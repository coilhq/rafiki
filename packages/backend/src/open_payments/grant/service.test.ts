import { IocContract } from '@adonisjs/fold'
import { faker } from '@faker-js/faker'
import { Knex } from 'knex'

import { Grant } from './model'
import { CreateOptions, GrantService } from './service'
import { AuthServer } from '../authServer/model'
import { initIocContainer } from '../..'
import { AppServices } from '../../app'
import { Config } from '../../config/app'
import { createTestApp, TestContainer } from '../../tests/app'
import { truncateTables } from '../../tests/tableManager'
import { AccessType, AccessAction } from '@interledger/open-payments'
import { v4 as uuid } from 'uuid'

describe('Grant Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let grantService: GrantService
  let knex: Knex

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    appContainer = await createTestApp(deps)
    knex = appContainer.knex
  })

  beforeEach(async (): Promise<void> => {
    grantService = await deps.use('grantService')
    jest.useFakeTimers()
    jest.setSystemTime(Date.now())
  })

  afterEach(async (): Promise<void> => {
    jest.useRealTimers()
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('Create and Get Grant', (): void => {
    describe.each`
      existingAuthServer | description
      ${false}           | ${'new auth server'}
      ${true}            | ${'existing auth server'}
    `('$description', ({ existingAuthServer }): void => {
      let authServerId: string | undefined
      let grant: Grant | undefined
      const authServerUrl = faker.internet.url({ appendSlash: false })

      beforeEach(async (): Promise<void> => {
        if (existingAuthServer) {
          const authServerService = await deps.use('authServerService')
          authServerId = (await authServerService.getOrCreate(authServerUrl)).id
        } else {
          await expect(
            AuthServer.query(knex).findOne({
              url: authServerUrl
            })
          ).resolves.toBeUndefined()
          authServerId = undefined
        }
      })

      afterEach(async (): Promise<void> => {
        if (existingAuthServer) {
          expect(grant?.authServerId).toEqual(authServerId)
        } else {
          await expect(
            AuthServer.query(knex).findOne({
              url: authServerUrl
            })
          ).resolves.toMatchObject({
            id: grant?.authServerId
          })
        }
      })

      test.each`
        expiresIn    | description
        ${undefined} | ${'without expiresIn'}
        ${600}       | ${'with expiresIn'}
      `(
        'Grant can be created and fetched ($description)',
        async ({ expiresIn }): Promise<void> => {
          const options: CreateOptions = {
            accessToken: uuid(),
            managementUrl: `${faker.internet.url({
              appendSlash: false
            })}/${uuid()}`,
            authServer: authServerUrl,
            accessType: AccessType.IncomingPayment,
            accessActions: [AccessAction.ReadAll]
          }
          grant = await grantService.create({
            ...options,
            expiresIn
          })
          expect(grant).toMatchObject({
            accessType: options.accessType,
            accessActions: options.accessActions,
            expiresAt: expiresIn
              ? new Date(Date.now() + expiresIn * 1000)
              : null
          })
          expect(grant.expired).toBe(false)
          await expect(grantService.get(options)).resolves.toEqual(grant)
        }
      )
    })

    test('cannot fetch non-existing grant', async (): Promise<void> => {
      const options: CreateOptions = {
        accessToken: uuid(),
        managementUrl: `${faker.internet.url({
          appendSlash: false
        })}/gt5hy6ju7ki8`,
        authServer: faker.internet.url({ appendSlash: false }),
        accessType: AccessType.IncomingPayment,
        accessActions: [AccessAction.ReadAll]
      }
      await grantService.create(options)
      await expect(
        grantService.get({
          ...options,
          authServer: faker.internet.url({ appendSlash: false })
        })
      ).resolves.toBeUndefined()
      await expect(
        grantService.get({
          ...options,
          accessType: AccessType.Quote
        })
      ).resolves.toBeUndefined()
      await expect(
        grantService.get({
          ...options,
          accessActions: [AccessAction.Read]
        })
      ).resolves.toBeUndefined()
    })

    test('cannot store grant with missing management url', async (): Promise<void> => {
      const options: CreateOptions = {
        accessToken: uuid(),
        managementUrl: '',
        authServer: faker.internet.url({ appendSlash: false }),
        accessType: AccessType.IncomingPayment,
        accessActions: [AccessAction.ReadAll]
      }
      await expect(grantService.create(options)).rejects.toThrow(
        'invalid management id'
      )
    })
  })

  describe.each`
    expiresIn    | description
    ${undefined} | ${'without prior expiresIn'}
    ${3000}      | ${'with prior expiresIn'}
  `('Update Grant ($description)', ({ expiresIn }): void => {
    let grant: Grant
    beforeEach(async (): Promise<void> => {
      const options = {
        authServer: faker.internet.url({ appendSlash: false }),
        accessType: AccessType.IncomingPayment,
        accessActions: [AccessAction.ReadAll],
        accessToken: uuid(),
        managementUrl: `${faker.internet.url({
          appendSlash: false
        })}/gt5hy6ju7ki8`,
        expiresIn
      }
      grant = await grantService.create(options)
    })
    test.each`
      expiresIn    | description
      ${undefined} | ${'without expiresIn'}
      ${6000}      | ${'with expiresIn'}
    `(
      'can update grant ($description)',
      async ({ expiresIn }): Promise<void> => {
        const updateOptions = {
          accessToken: uuid(),
          managementUrl: `${faker.internet.url({
            appendSlash: false
          })}/${uuid()}`,
          expiresIn
        }
        const updatedGrant = await grantService.update(grant, updateOptions)
        expect(updatedGrant).toEqual({
          ...grant,
          accessToken: updateOptions.accessToken,
          managementId: updateOptions.managementUrl.split('/').pop(),
          expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
          updatedAt: updatedGrant.updatedAt
        })
      }
    )
  })
})
