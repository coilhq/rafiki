import { IocContract } from '@adonisjs/fold'
import { AppServices } from '../app'
import { createTestApp, TestContainer } from '../tests/app'
import { Amount } from '../open_payments/amount'
import { WalletAddress } from '../open_payments/wallet_address/model'
import { IncomingPaymentService } from '../open_payments/payment/incoming/service'
import { Config, IAppConfig } from '../config/app'
import { createAsset } from '../tests/asset'
import { truncateTables } from '../tests/tableManager'
import { initIocContainer } from '..'
import { OutgoingPaymentService } from '../open_payments/payment/outgoing/service'
import { QuoteService } from '../open_payments/quote/service'
import { createIncomingPayment } from '../tests/incomingPayment'
import { createQuote } from '../tests/quote'
import { createOutgoingPayment } from '../tests/outgoingPayment'
import { createWalletAddress } from '../tests/walletAddress'
import { getPageInfo, parsePaginationQueryParameters } from './pagination'
import { AssetService } from '../asset/service'
import { PeerService } from '../payment-method/ilp/peer/service'
import { createPeer } from '../tests/peer'

describe('Pagination', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer
  let incomingPaymentService: IncomingPaymentService
  let outgoingPaymentService: OutgoingPaymentService
  let quoteService: QuoteService
  let config: IAppConfig

  beforeAll(async (): Promise<void> => {
    config = Config
    config.openPaymentsUrl = 'https://wallet.example'
    deps = await initIocContainer(config)
    appContainer = await createTestApp(deps)
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })
  describe('parsePaginationQueryParameters', (): void => {
    let walletAddress: WalletAddress

    beforeEach(async (): Promise<void> => {
      const asset = await createAsset(deps)
      walletAddress = await createWalletAddress(deps, {
        tenantId: Config.operatorTenantId,
        assetId: asset.id
      })
    })

    test.each`
      first        | last         | cursor   | result
      ${undefined} | ${undefined} | ${''}    | ${{ first: undefined, last: undefined, before: undefined, after: undefined }}
      ${10}        | ${undefined} | ${''}    | ${{ first: 10, last: undefined, before: undefined, after: undefined }}
      ${10}        | ${undefined} | ${'abc'} | ${{ first: 10, last: undefined, before: undefined, after: 'abc' }}
      ${undefined} | ${20}        | ${'efg'} | ${{ first: undefined, last: 20, before: 'efg', after: undefined }}
    `(
      "success with first: '$first', last: '$last', cursor: '$cursor'",
      async ({ first, last, cursor, result }): Promise<void> => {
        expect(
          parsePaginationQueryParameters({
            first,
            last,
            cursor,
            'wallet-address': walletAddress.url
          })
        ).toEqual({ ...result, walletAddress: walletAddress.url })
      }
    )
  })
  describe('getPageInfo', (): void => {
    describe('wallet address resources', (): void => {
      let defaultWalletAddress: WalletAddress
      let secondaryWalletAddress: WalletAddress
      let debitAmount: Amount

      beforeEach(async (): Promise<void> => {
        incomingPaymentService = await deps.use('incomingPaymentService')
        outgoingPaymentService = await deps.use('outgoingPaymentService')
        quoteService = await deps.use('quoteService')

        const asset = await createAsset(deps)
        defaultWalletAddress = await createWalletAddress(deps, {
          tenantId: Config.operatorTenantId,
          assetId: asset.id
        })
        secondaryWalletAddress = await createWalletAddress(deps, {
          tenantId: Config.operatorTenantId,
          assetId: asset.id
        })
        debitAmount = {
          value: BigInt(42),
          assetCode: asset.code,
          assetScale: asset.scale
        }
      })

      describe('incoming payments', (): void => {
        test.each`
          num   | pagination       | cursor  | start   | end     | hasNextPage | hasPreviousPage
          ${0}  | ${{ first: 5 }}  | ${null} | ${null} | ${null} | ${false}    | ${false}
          ${10} | ${{ first: 5 }}  | ${null} | ${0}    | ${4}    | ${true}     | ${false}
          ${5}  | ${{ first: 10 }} | ${null} | ${0}    | ${4}    | ${false}    | ${false}
          ${10} | ${{ first: 3 }}  | ${3}    | ${4}    | ${6}    | ${true}     | ${true}
          ${10} | ${{ last: 5 }}   | ${9}    | ${4}    | ${8}    | ${true}     | ${true}
        `(
          '$num payments, pagination $pagination with cursor $cursor',
          async ({
            num,
            pagination,
            cursor,
            start,
            end,
            hasNextPage,
            hasPreviousPage
          }): Promise<void> => {
            const paymentIds: string[] = []
            for (let i = 0; i < num; i++) {
              const payment = await createIncomingPayment(deps, {
                walletAddressId: defaultWalletAddress.id,
                tenantId: Config.operatorTenantId
              })
              paymentIds.push(payment.id)
            }
            paymentIds.reverse() // default order is descending
            if (cursor) {
              if (pagination.last) pagination.before = paymentIds[cursor]
              else pagination.after = paymentIds[cursor]
            }
            const page = await incomingPaymentService.getWalletAddressPage({
              walletAddressId: defaultWalletAddress.id,
              pagination
            })
            const pageInfo = await getPageInfo({
              getPage: (pagination) =>
                incomingPaymentService.getWalletAddressPage({
                  walletAddressId: defaultWalletAddress.id,
                  pagination
                }),
              page,
              walletAddress: defaultWalletAddress.url
            })
            expect(pageInfo).toEqual({
              startCursor: paymentIds[start],
              endCursor: paymentIds[end],
              hasNextPage,
              hasPreviousPage
            })
          }
        )
      })
      describe('outgoing payments', (): void => {
        test.each`
          num   | pagination       | cursor  | start   | end     | hasNextPage | hasPreviousPage
          ${0}  | ${{ first: 5 }}  | ${null} | ${null} | ${null} | ${false}    | ${false}
          ${10} | ${{ first: 5 }}  | ${null} | ${0}    | ${4}    | ${true}     | ${false}
          ${5}  | ${{ first: 10 }} | ${null} | ${0}    | ${4}    | ${false}    | ${false}
          ${10} | ${{ first: 3 }}  | ${3}    | ${4}    | ${6}    | ${true}     | ${true}
          ${10} | ${{ last: 5 }}   | ${9}    | ${4}    | ${8}    | ${true}     | ${true}
        `(
          '$num payments, pagination $pagination with cursor $cursor',
          async ({
            num,
            pagination,
            cursor,
            start,
            end,
            hasNextPage,
            hasPreviousPage
          }): Promise<void> => {
            const paymentIds: string[] = []
            for (let i = 0; i < num; i++) {
              const payment = await createOutgoingPayment(deps, {
                walletAddressId: defaultWalletAddress.id,
                receiver: secondaryWalletAddress.url,
                method: 'ilp',
                debitAmount,
                validDestination: false
              })
              paymentIds.push(payment.id)
            }
            paymentIds.reverse() // default order is descending
            if (cursor) {
              if (pagination.last) pagination.before = paymentIds[cursor]
              else pagination.after = paymentIds[cursor]
            }
            const page = await outgoingPaymentService.getWalletAddressPage({
              walletAddressId: defaultWalletAddress.id,
              pagination
            })
            const pageInfo = await getPageInfo({
              getPage: (pagination) =>
                outgoingPaymentService.getWalletAddressPage({
                  walletAddressId: defaultWalletAddress.id,
                  pagination
                }),
              page,
              walletAddress: defaultWalletAddress.url
            })
            expect(pageInfo).toEqual({
              startCursor: paymentIds[start],
              endCursor: paymentIds[end],
              hasNextPage,
              hasPreviousPage
            })
          }
        )
      })
      describe('quotes', (): void => {
        test.each`
          num   | pagination       | cursor  | start   | end     | hasNextPage | hasPreviousPage
          ${0}  | ${{ first: 5 }}  | ${null} | ${null} | ${null} | ${false}    | ${false}
          ${10} | ${{ first: 5 }}  | ${null} | ${0}    | ${4}    | ${true}     | ${false}
          ${5}  | ${{ first: 10 }} | ${null} | ${0}    | ${4}    | ${false}    | ${false}
          ${10} | ${{ first: 3 }}  | ${3}    | ${4}    | ${6}    | ${true}     | ${true}
          ${10} | ${{ last: 5 }}   | ${9}    | ${4}    | ${8}    | ${true}     | ${true}
        `(
          '$num quotes, pagination $pagination with cursor $cursor',
          async ({
            num,
            pagination,
            cursor,
            start,
            end,
            hasNextPage,
            hasPreviousPage
          }): Promise<void> => {
            const quoteIds: string[] = []
            for (let i = 0; i < num; i++) {
              const quote = await createQuote(deps, {
                walletAddressId: defaultWalletAddress.id,
                receiver: secondaryWalletAddress.url,
                debitAmount,
                validDestination: false,
                method: 'ilp'
              })
              quoteIds.push(quote.id)
            }
            quoteIds.reverse() // default order is descending
            if (cursor) {
              if (pagination.last) pagination.before = quoteIds[cursor]
              else pagination.after = quoteIds[cursor]
            }
            const page = await quoteService.getWalletAddressPage({
              walletAddressId: defaultWalletAddress.id,
              pagination
            })
            const pageInfo = await getPageInfo({
              getPage: (pagination) =>
                quoteService.getWalletAddressPage({
                  walletAddressId: defaultWalletAddress.id,
                  pagination
                }),
              page,
              walletAddress: defaultWalletAddress.url
            })
            expect(pageInfo).toEqual({
              startCursor: quoteIds[start],
              endCursor: quoteIds[end],
              hasNextPage,
              hasPreviousPage
            })
          }
        )
      })
    })
    describe('non-wallet address resources', (): void => {
      let assetService: AssetService
      let peerService: PeerService
      beforeEach(async (): Promise<void> => {
        assetService = await deps.use('assetService')
        peerService = await deps.use('peerService')
      })
      describe('assets', (): void => {
        test.each`
          num   | pagination       | cursor  | start   | end     | hasNextPage | hasPreviousPage
          ${0}  | ${{ first: 5 }}  | ${null} | ${null} | ${null} | ${false}    | ${false}
          ${10} | ${{ first: 5 }}  | ${null} | ${0}    | ${4}    | ${true}     | ${false}
          ${5}  | ${{ first: 10 }} | ${null} | ${0}    | ${4}    | ${false}    | ${false}
          ${10} | ${{ first: 3 }}  | ${3}    | ${4}    | ${6}    | ${true}     | ${true}
          ${10} | ${{ last: 5 }}   | ${9}    | ${4}    | ${8}    | ${true}     | ${true}
        `(
          '$num assets, pagination $pagination with cursor $cursor',
          async ({
            num,
            pagination,
            cursor,
            start,
            end,
            hasNextPage,
            hasPreviousPage
          }): Promise<void> => {
            const assetIds: string[] = []
            for (let i = 0; i < num; i++) {
              const asset = await createAsset(deps)
              assetIds.push(asset.id)
            }
            assetIds.reverse() // default order is descending
            if (cursor) {
              if (pagination.last) pagination.before = assetIds[cursor]
              else pagination.after = assetIds[cursor]
            }
            const page = await assetService.getPage({
              pagination,
              tenantId: config.operatorTenantId
            })
            const pageInfo = await getPageInfo({
              getPage: (pagination) =>
                assetService.getPage({
                  pagination,
                  tenantId: config.operatorTenantId
                }),
              page
            })
            expect(pageInfo).toEqual({
              startCursor: assetIds[start],
              endCursor: assetIds[end],
              hasNextPage,
              hasPreviousPage
            })
          }
        )
      })
      describe('peers', (): void => {
        test.each`
          num   | pagination       | cursor  | start   | end     | hasNextPage | hasPreviousPage
          ${0}  | ${{ first: 5 }}  | ${null} | ${null} | ${null} | ${false}    | ${false}
          ${10} | ${{ first: 5 }}  | ${null} | ${0}    | ${4}    | ${true}     | ${false}
          ${5}  | ${{ first: 10 }} | ${null} | ${0}    | ${4}    | ${false}    | ${false}
          ${10} | ${{ first: 3 }}  | ${3}    | ${4}    | ${6}    | ${true}     | ${true}
          ${10} | ${{ last: 5 }}   | ${9}    | ${4}    | ${8}    | ${true}     | ${true}
        `(
          '$num peers, pagination $pagination with cursor $cursor',
          async ({
            num,
            pagination,
            cursor,
            start,
            end,
            hasNextPage,
            hasPreviousPage
          }): Promise<void> => {
            const peerIds: string[] = []
            for (let i = 0; i < num; i++) {
              const peer = await createPeer(deps)
              peerIds.push(peer.id)
            }
            peerIds.reverse() // default order is descending
            if (cursor) {
              if (pagination.last) pagination.before = peerIds[cursor]
              else pagination.after = peerIds[cursor]
            }
            const page = await peerService.getPage(pagination)
            const pageInfo = await getPageInfo({
              getPage: (pagination) => peerService.getPage(pagination),
              page
            })
            expect(pageInfo).toEqual({
              startCursor: peerIds[start],
              endCursor: peerIds[end],
              hasNextPage,
              hasPreviousPage
            })
          }
        )
      })
    })
  })
})
