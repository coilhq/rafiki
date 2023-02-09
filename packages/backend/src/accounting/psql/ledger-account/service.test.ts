import { Knex } from 'knex'
import { v4 as uuid } from 'uuid'

import { LedgerAccountService } from './service'
import { createTestApp, TestContainer } from '../../../tests/app'
import { LedgerAccount, LedgerAccountType } from './model'
import { Config } from '../../../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../../..'
import { AppServices } from '../../../app'
import { Asset } from '../../../asset/model'
import { randomAsset } from '../../../tests/asset'
import { truncateTables } from '../../../tests/tableManager'
import { AccountAlreadyExistsError } from '../../errors'
import { ForeignKeyViolationError } from 'objection'

describe('Ledger Account Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let ledgerAccountService: LedgerAccountService
  let knex: Knex
  let asset: Asset

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer({ ...Config, useTigerbeetle: false })
    appContainer = await createTestApp(deps)
    knex = appContainer.knex
    ledgerAccountService = await deps.use('ledgerAccountService')
  })

  beforeEach(async (): Promise<void> => {
    asset = await Asset.query().insertAndFetch(randomAsset())
  })

  afterEach(async (): Promise<void> => {
    jest.useRealTimers()
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('create', (): void => {
    test('creates ledger account', async (): Promise<void> => {
      const accountRef = uuid()
      const type = LedgerAccountType.LIQUIDITY_ASSET

      const account = await ledgerAccountService.create({
        assetId: asset.id,
        accountRef,
        type
      })

      expect(account).toEqual({
        id: expect.any(String),
        accountRef,
        assetId: asset.id,
        type,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    test('throws if violates unique accountRef & type constraint', async (): Promise<void> => {
      const accountRef = uuid()
      const type = LedgerAccountType.SETTLEMENT

      await LedgerAccount.query().insertAndFetch({
        assetId: asset.id,
        accountRef,
        type
      })

      await expect(
        ledgerAccountService.create({
          assetId: asset.id,
          accountRef,
          type
        })
      ).rejects.toThrow(AccountAlreadyExistsError)
    })

    test('throws if violates asset.id foreign key constraint', async (): Promise<void> => {
      await expect(
        ledgerAccountService.create({
          assetId: uuid(),
          accountRef: uuid(),
          type: LedgerAccountType.SETTLEMENT
        })
      ).rejects.toThrow(ForeignKeyViolationError)
    })
  })
})
