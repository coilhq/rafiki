import assert from 'assert'
import { v4 as uuid } from 'uuid'

import { AssetError, isAssetError } from './errors'
import { AssetService } from './service'
import { Pagination } from '../shared/baseModel'
import { getPageTests } from '../shared/baseModel.test'
import { createTestApp, TestContainer } from '../tests/app'
import { createAsset, randomAsset } from '../tests/asset'
import { truncateTables } from '../tests/tableManager'
import { Config } from '../config/app'
import { IocContract } from '@adonisjs/fold'
import { initIocContainer } from '../'
import { AppServices } from '../app'
import { LiquidityAccountType } from '../accounting/service'
import { CheckViolationError } from 'objection'

describe('Asset Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let assetService: AssetService

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer(Config)
    appContainer = await createTestApp(deps)
    assetService = await deps.use('assetService')
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('create', (): void => {
    test.each`
      withdrawalThreshold
      ${undefined}
      ${BigInt(5)}
    `(
      'Asset can be created and fetched',
      async ({ withdrawalThreshold }): Promise<void> => {
        const options = {
          ...randomAsset(),
          withdrawalThreshold
        }
        const asset = await assetService.create(options)
        assert.ok(!isAssetError(asset))
        expect(asset).toMatchObject({
          ...options,
          id: asset.id,
          ledger: asset.ledger,
          withdrawalThreshold: withdrawalThreshold || null
        })
        await expect(assetService.get(asset.id)).resolves.toEqual(asset)
      }
    )

    test('Asset accounts are created', async (): Promise<void> => {
      const accountingService = await deps.use('accountingService')
      const liquiditySpy = jest.spyOn(
        accountingService,
        'createLiquidityAccount'
      )
      const settlementSpy = jest.spyOn(
        accountingService,
        'createSettlementAccount'
      )

      const asset = await assetService.create(randomAsset())
      assert.ok(!isAssetError(asset))

      expect(liquiditySpy).toHaveBeenCalledWith(
        asset,
        LiquidityAccountType.ASSET,
        expect.any(Function)
      )
      expect(settlementSpy).toHaveBeenCalledWith(
        asset.ledger,
        expect.any(Function)
      )

      await expect(accountingService.getBalance(asset.id)).resolves.toEqual(
        BigInt(0)
      )
      await expect(
        accountingService.getSettlementBalance(asset.ledger)
      ).resolves.toEqual(BigInt(0))
    })

    test('Asset can be created with minimum account withdrawal amount', async (): Promise<void> => {
      const options = {
        ...randomAsset(),
        withdrawalThreshold: BigInt(10)
      }
      const asset = await assetService.create(options)
      assert.ok(!isAssetError(asset))
      expect(asset).toMatchObject({
        ...options,
        id: asset.id,
        ledger: asset.ledger
      })
      await expect(assetService.get(asset.id)).resolves.toEqual(asset)
    })

    test('Cannot create duplicate asset', async (): Promise<void> => {
      const options = randomAsset()
      await expect(assetService.create(options)).resolves.toMatchObject(options)
      await expect(assetService.create(options)).resolves.toEqual(
        AssetError.DuplicateAsset
      )
    })

    test('Cannot create asset with scale > 255', async (): Promise<void> => {
      const options = {
        code: 'ABC',
        scale: 256
      }
      await expect(assetService.create(options)).rejects.toThrow(
        CheckViolationError
      )
    })
  })

  describe('get', (): void => {
    test('Can get asset by id', async (): Promise<void> => {
      const asset = await assetService.create(randomAsset())
      assert.ok(!isAssetError(asset))
      await expect(assetService.get(asset.id)).resolves.toEqual(asset)
    })

    test('Cannot get unknown asset', async (): Promise<void> => {
      await expect(assetService.get(uuid())).resolves.toBeUndefined()
    })
  })

  describe('update', (): void => {
    describe.each`
      withdrawalThreshold
      ${null}
      ${BigInt(0)}
      ${BigInt(5)}
    `(
      "Asset's withdrawal threshold can be updated from $withdrawalThreshold",
      ({ withdrawalThreshold }): void => {
        let assetId: string

        beforeEach(async (): Promise<void> => {
          const asset = await assetService.create({
            ...randomAsset(),
            withdrawalThreshold
          })
          assert.ok(!isAssetError(asset))
          expect(asset.withdrawalThreshold).toEqual(withdrawalThreshold)
          assetId = asset.id
        })

        test.each`
          withdrawalThreshold
          ${null}
          ${BigInt(0)}
          ${BigInt(5)}
        `(
          'to $withdrawalThreshold',
          async ({ withdrawalThreshold }): Promise<void> => {
            const asset = await assetService.update({
              id: assetId,
              withdrawalThreshold
            })
            assert.ok(!isAssetError(asset))
            expect(asset.withdrawalThreshold).toEqual(withdrawalThreshold)
            await expect(assetService.get(assetId)).resolves.toEqual(asset)
          }
        )
      }
    )

    test('Cannot update unknown asset', async (): Promise<void> => {
      await expect(
        assetService.update({
          id: uuid(),
          withdrawalThreshold: BigInt(10)
        })
      ).resolves.toEqual(AssetError.UnknownAsset)
    })
  })

  describe('getPage', (): void => {
    getPageTests({
      createModel: () => createAsset(deps),
      getPage: (pagination?: Pagination) => assetService.getPage(pagination)
    })
  })
})
