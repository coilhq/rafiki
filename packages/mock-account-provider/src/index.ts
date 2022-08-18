import { EventEmitter } from 'events'
import createLogger from 'pino'
import { Ioc, IocContract } from '@adonisjs/fold'

import { App, AppServices } from './app'
import { Config } from './config/app'

const container = initIocContainer(Config)
const app = new App(container)

export function initIocContainer(
  config: typeof Config
): IocContract<AppServices> {
  const container: IocContract<AppServices> = new Ioc()

  container.singleton('config', async () => config)
  container.singleton('logger', async (deps: IocContract<AppServices>) => {
    const config = await deps.use('config')
    const logger = createLogger()
    logger.level = config.logLevel
    return logger
  })

  container.singleton('closeEmitter', async () => new EventEmitter())

  return container
}

export const gracefulShutdown = async (
  container: IocContract<AppServices>,
  app: App
): Promise<void> => {
  const logger = await container.use('logger')
  logger.info('shutting down.')
  await app.shutdown()
}

export const start = async (
  container: IocContract<AppServices>,
  app: App
): Promise<void> => {
  let shuttingDown = false
  const logger = await container.use('logger')
  process.on(
    'SIGINT',
    async (): Promise<void> => {
      logger.info('received SIGINT attempting graceful shutdown')
      try {
        if (shuttingDown) {
          logger.warn(
            'received second SIGINT during graceful shutdown, exiting forcefully.'
          )
          process.exit(1)
        }

        shuttingDown = true

        // Graceful shutdown
        await gracefulShutdown(container, app)
        logger.info('completed graceful shutdown.')
        process.exit(0)
      } catch (err) {
        const errInfo =
          err && typeof err === 'object' && err.stack ? err.stack : err
        logger.error({ error: errInfo }, 'error while shutting down')
        process.exit(1)
      }
    }
  )

  process.on(
    'SIGTERM',
    async (): Promise<void> => {
      logger.info('received SIGTERM attempting graceful shutdown')

      try {
        // Graceful shutdown
        await gracefulShutdown(container, app)
        logger.info('completed graceful shutdown.')
        process.exit(0)
      } catch (err) {
        const errInfo =
          err && typeof err === 'object' && err.stack ? err.stack : err
        logger.error({ error: errInfo }, 'error while shutting down')
        process.exit(1)
      }
    }
  )

  const config = await container.use('config')
  await app.boot()
  app.listen(config.port)
  logger.info(`Auth mock server listening on ${app.getPort()}`)
}

// If this script is run directly, start the server
if (!module.parent) {
  start(container, app).catch(
    async (e): Promise<void> => {
      const errInfo = e && typeof e === 'object' && e.stack ? e.stack : e
      const logger = await container.use('logger')
      logger.error(errInfo)
    }
  )
}
