import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../../../app'
import { TestContainer, createTestApp } from '../../../tests/app'
import { initIocContainer } from '../../..'
import { Config } from '../../../config/app'
import { CombinedPaymentService } from './service'
import { Knex } from 'knex'
import { truncateTables } from '../../../tests/tableManager'
import { getPageTests } from '../../../shared/baseModel.test'
import { createOutgoingPayment } from '../../../tests/outgoingPayment'
import { createAsset } from '../../../tests/asset'
import {
  MockWalletAddress,
  createWalletAddress
} from '../../../tests/walletAddress'
import { createIncomingPayment } from '../../../tests/incomingPayment'
import { Pagination, SortOrder } from '../../../shared/baseModel'
import { PaymentType } from './model'
import { Asset } from '../../../asset/model'
import {
  createCombinedPayment,
  toCombinedPayment
} from '../../../tests/combinedPayment'

describe('Combined Payment Service', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let knex: Knex
  let combinedPaymentService: CombinedPaymentService
  let sendAsset: Asset
  let sendWalletAddressId: string
  let receiveAsset: Asset
  let receiveWalletAddress: MockWalletAddress

  beforeAll(async (): Promise<void> => {
    deps = await initIocContainer(Config)
    appContainer = await createTestApp(deps)
    knex = appContainer.knex
    combinedPaymentService = await deps.use('combinedPaymentService')
  })

  beforeEach(async (): Promise<void> => {
    sendAsset = await createAsset(deps)
    receiveAsset = await createAsset(deps)
    sendWalletAddressId = (
      await createWalletAddress(deps, {
        tenantId: sendAsset.tenantId,
        assetId: sendAsset.id
      })
    ).id
    receiveWalletAddress = await createWalletAddress(deps, {
      tenantId: sendAsset.tenantId,
      assetId: receiveAsset.id
    })
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  async function setupPayments(deps: IocContract<AppServices>) {
    const incomingPayment = await createIncomingPayment(deps, {
      walletAddressId: receiveWalletAddress.id,
      tenantId: Config.operatorTenantId
    })
    const receiverUrl = incomingPayment.getUrl(receiveWalletAddress)

    const outgoingPayment = await createOutgoingPayment(deps, {
      walletAddressId: sendWalletAddressId,
      method: 'ilp',
      receiver: receiverUrl,
      debitAmount: {
        value: BigInt(123),
        assetCode: sendAsset.code,
        assetScale: sendAsset.scale
      },
      validDestination: false
    })

    return {
      outgoingPayment,
      incomingPayment
    }
  }

  describe('CombinedPayment Service', (): void => {
    getPageTests({
      createModel: () => createCombinedPayment(deps),
      getPage: (pagination?: Pagination, sortOrder?: SortOrder) =>
        combinedPaymentService.getPage({ pagination, sortOrder })
    })

    test('should return empty array if no payments', async (): Promise<void> => {
      const payments = await combinedPaymentService.getPage()
      expect(payments).toEqual([])
    })

    test('can get all', async (): Promise<void> => {
      const { incomingPayment, outgoingPayment } = await setupPayments(deps)
      const payments = await combinedPaymentService.getPage()
      expect(payments.length).toEqual(2)
      expect(
        payments.find((p) => p.type === PaymentType.Outgoing)
      ).toMatchObject(toCombinedPayment(PaymentType.Outgoing, outgoingPayment))
      expect(
        payments.find((p) => p.type === PaymentType.Incoming)
      ).toMatchObject(toCombinedPayment(PaymentType.Incoming, incomingPayment))
    })

    test('can filter by walletAddressId', async (): Promise<void> => {
      const { incomingPayment } = await setupPayments(deps)
      const payments = await combinedPaymentService.getPage({
        filter: {
          walletAddressId: {
            in: [incomingPayment.walletAddressId]
          }
        }
      })
      expect(payments.length).toEqual(1)
      expect(payments[0]).toMatchObject(
        toCombinedPayment(PaymentType.Incoming, incomingPayment)
      )
    })

    test('can filter by type', async (): Promise<void> => {
      const { outgoingPayment } = await setupPayments(deps)
      const payments = await combinedPaymentService.getPage({
        filter: {
          type: {
            in: [PaymentType.Outgoing]
          }
        }
      })
      expect(payments.length).toEqual(1)
      expect(payments[0]).toMatchObject(
        toCombinedPayment(PaymentType.Outgoing, outgoingPayment)
      )
    })
  })
})
