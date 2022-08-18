'use strict'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require('../../jest.config.base.js')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageName = require('./package.json').name

module.exports = {
  ...baseConfig,
  clearMocks: true,
  testTimeout: 15000,
  roots: [`<rootDir>/packages/${packageName}`],
  globalSetup: `<rootDir>/packages/${packageName}/jest.setup.js`,
  globalTeardown: `<rootDir>/packages/${packageName}/jest.teardown.js`,
  testRegex: `(packages/${packageName}/.*/__tests__/.*|\\.(test|spec))\\.tsx?$`,
  moduleDirectories: [
    `node_modules`,
    `packages/${packageName}/node_modules`,
    `<rootDir>/node_modules`
  ],
  modulePaths: [
    `node_modules`,
    `<rootDir>/packages/${packageName}/src/`,
    `<rootDir>/node_modules`
  ],
  id: packageName,
  displayName: packageName,
  rootDir: '../..'
}
