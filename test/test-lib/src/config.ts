import { parse } from 'yaml'
import { readFileSync } from 'fs'
import { loadKey } from '@interledger/http-signature-utils'
import type { Config } from 'mock-account-service-lib'
import { parse as envParse } from 'dotenv'

import { resolve } from 'path'

export type TestConfig = Config & {
  integrationServerPort: number
  interactionServer: string
  walletAddressUrl: string
  keyId: string
  signatureSecret: string
  signatureVersion: string
}

type EnvConfig = {
  OPEN_PAYMENTS_URL: string
  AUTH_SERVER_DOMAIN: string
  INTERACTION_SERVER: string
  INTEGRATION_SERVER_PORT: string
  WALLET_ADDRESS_URL: string
  GRAPHQL_URL: string
  KEY_ID: string
  IDP_SECRET: string
  SIGNATURE_SECRET: string
  SIGNATURE_VERSION: string
}
const REQUIRED_KEYS: (keyof EnvConfig)[] = [
  'OPEN_PAYMENTS_URL',
  'AUTH_SERVER_DOMAIN',
  'INTERACTION_SERVER',
  'INTEGRATION_SERVER_PORT',
  'WALLET_ADDRESS_URL',
  'GRAPHQL_URL',
  'KEY_ID',
  'IDP_SECRET'
]

const loadEnv = (filePath: string): EnvConfig => {
  const fileContent = readFileSync(filePath)
  const envVars = envParse(fileContent)

  const missingKeys: string[] = []
  REQUIRED_KEYS.forEach((key) => {
    if (!envVars[key]) {
      missingKeys.push(key)
    }
  })

  if (missingKeys.length > 0) {
    const errorMessage = `Missing required environment variable(s): ${missingKeys.join(', ')}`
    throw new Error(errorMessage)
  }

  return envVars as EnvConfig
}

const createConfig = (name: string): TestConfig => {
  const seedPath = resolve(__dirname, `../../testenv/${name}/seed.yml`)
  const env = loadEnv(resolve(__dirname, `../../testenv/${name}/.env`))
  const keyPath = resolve(__dirname, `../../testenv/private-key.pem`)

  return {
    seed: parse(readFileSync(seedPath).toString('utf8')),
    key: loadKey(keyPath),
    publicHost: env.OPEN_PAYMENTS_URL,
    testnetAutoPeerUrl: '',
    authServerDomain: env.AUTH_SERVER_DOMAIN,
    interactionServer: env.INTERACTION_SERVER,
    integrationServerPort: parseInt(env.INTEGRATION_SERVER_PORT),
    walletAddressUrl: env.WALLET_ADDRESS_URL,
    graphqlUrl: env.GRAPHQL_URL,
    keyId: env.KEY_ID,
    idpSecret: env.IDP_SECRET,
    signatureSecret: env.SIGNATURE_SECRET,
    signatureVersion: env.SIGNATURE_VERSION
  }
}

export const C9_CONFIG: TestConfig = createConfig('cloud-nine-wallet')
export const HLB_CONFIG: TestConfig = createConfig('happy-life-bank')
