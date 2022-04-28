import createLogger from 'pino'
import Knex from 'knex'
import nock from 'nock'
import { IocContract } from '@adonisjs/fold'

import { start, gracefulShutdown } from '..'
import { App, AppServices } from '../app'

export interface TestContainer {
  port: number
  app: App
  knex: Knex
  apolloClient: ApolloClient<NormalizedCacheObject>
  connectionUrl: string
  shutdown: () => Promise<void>
}

export const createTestApp = async (
  container: IocContract<AppServices>
): Promise<TestContainer> => {
  const config = await container.use('config')
  config.port = 0
  const logger = createLogger({
    prettyPrint: {
      translateTime: true,
      ignore: 'pid,hostname'
    },
    level: process.env.LOG_LEVEL || 'error',
    name: 'test-logger'
  })

  container.bind('logger', async () => logger)

  const app = new App(container)
  await start(container, app)

  const knex = await container.use('knex')

  return {
    app,
    port: app.getPort(),
    knex,
    connectionUrl: config.databaseUrl,
    shutdown: async () => {
      nock.cleanAll()
      await gracefulShutdown(container, app)
    }
  }
}
