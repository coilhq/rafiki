import { gql } from 'apollo-server-koa'
import { Transaction } from 'knex'

import { createTestApp, TestContainer } from '../../tests/app'
import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../app'
import { initIocContainer } from '../..'
import { Config } from '../../config/app'
import { User } from '../generated/graphql'
import { User as UserModel } from '../../user/model'
import { UserService } from '../../user/service'

describe('User', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let userService: UserService
  let user: UserModel
  let trx: Transaction

  beforeAll(
    async (): Promise<void> => {
      deps = await initIocContainer(Config)
      appContainer = await createTestApp(deps)
    }
  )

  beforeEach(
    async (): Promise<void> => {
      trx = await appContainer.knex.transaction()
      userService = await deps.use('userService')
      user = await userService.create('34ff06c3-f25b-4ab7-8525-eefa17204ede')
    }
  )

  afterEach(
    async (): Promise<void> => {
      await trx.rollback()
      await trx.destroy()
    }
  )

  afterAll(
    async (): Promise<void> => {
      await appContainer.apolloClient.stop()
      await appContainer.shutdown()
    }
  )

  describe('Query user', (): void => {
    test('Can get a user', async (): Promise<void> => {
      const query = await appContainer.apolloClient
        .query({
          query: gql`
            query User {
              user {
                id
              }
            }
          `
        })
        .then(
          (query): User => {
            if (query.data) {
              return query.data.user
            } else {
              throw new Error('Data was empty')
            }
          }
        )
      expect(query.id).toEqual(user.id)
    })
  })
})
