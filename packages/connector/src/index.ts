import createLogger from 'pino'

import { Config } from './services/accounts'
import { initIocContainer, start as startAccounts } from './accounts'
import { start as startConnector } from './connector'

const logger = createLogger()

const container = initIocContainer(Config)

export const start = async (): Promise<void> => {
  logger.info('🚀 the 🐒')
  const app = await startAccounts(container)
  await startConnector(app.getAccounts())
  logger.info('🐒 has 🚀. Get ready for 🍌🍌🍌🍌🍌')
}

// If this script is run directly, start the server
if (!module.parent) {
  start().catch((e) => {
    const errInfo = e && typeof e === 'object' && e.stack ? e.stack : e
    logger.error(errInfo)
  })
}
