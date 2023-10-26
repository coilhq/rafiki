import { faker } from '@faker-js/faker'
import * as httpMocks from 'node-mocks-http'
import { AccessAction } from '@interledger/open-payments'
import { v4 as uuid } from 'uuid'

import {
  WalletAddress,
  WalletAddressSubresource,
  GetOptions,
  ListOptions
} from './model'
import { Grant } from '../auth/middleware'
import {
  WalletAddressContext,
  ReadContext,
  ListContext,
  AppServices,
  AuthenticatedStatusContext
} from '../../app'
import { getPageTests } from '../../shared/baseModel.test'
import { SortOrder } from '../../shared/baseModel'
import { createContext } from '../../tests/context'
import { createWalletAddress } from '../../tests/walletAddress'
import { truncateTables } from '../../tests/tableManager'
import { initIocContainer } from '../..'
import { createTestApp, TestContainer } from '../../tests/app'
import { Config } from '../../config/app'
import { IocContract } from '@adonisjs/fold'
import assert from 'assert'
import { ReadContextWithAuthenticatedStatus } from '../payment/incoming/routes'

export interface SetupOptions {
  reqOpts: httpMocks.RequestOptions
  params?: Record<string, string>
  walletAddress: WalletAddress
  grant?: Grant
  client?: string
  accessAction?: AccessAction
}

export const setup = <
  T extends WalletAddressContext & Partial<AuthenticatedStatusContext>
>(
  options: SetupOptions
): T => {
  const ctx = createContext<T>(
    {
      ...options.reqOpts,
      headers: Object.assign(
        { Accept: 'application/json', 'Content-Type': 'application/json' },
        options.reqOpts.headers
      )
    },
    options.params
  )
  ctx.walletAddress = options.walletAddress
  ctx.grant = options.grant
  ctx.client = options.client
  ctx.accessAction = options.accessAction
  ctx.authenticated = true
  return ctx
}

interface TestGetOptions extends GetOptions {
  walletAddressId: NonNullable<GetOptions['walletAddressId']>
}

interface BaseTestsOptions<M> {
  createModel: (options: { client?: string }) => Promise<M>
  testGet: (options: TestGetOptions, expectedMatch?: M) => void
  testList?: (options: ListOptions, expectedMatch?: M) => void
  sortOrder?: SortOrder
}

const baseGetTests = <M extends WalletAddressSubresource>({
  createModel,
  testGet,
  testList
}: BaseTestsOptions<M>): void => {
  enum GetOption {
    Matching = 'matching',
    Conflicting = 'conflicting',
    Unspecified = 'unspecified'
  }

  describe.each`
    withClient | description
    ${true}    | ${'with client'}
    ${false}   | ${'without client'}
  `(
    'Common WalletAddressSubresource get/getWalletAddressPage ($description)',
    ({ withClient }): void => {
      const resourceClient = faker.internet.url({ appendSlash: false })

      describe.each`
        client                                        | match    | description
        ${resourceClient}                             | ${true}  | ${GetOption.Matching}
        ${faker.internet.url({ appendSlash: false })} | ${false} | ${GetOption.Conflicting}
        ${undefined}                                  | ${true}  | ${GetOption.Unspecified}
      `('$description client', ({ client, match, description }): void => {
        // Do not test matching client if model has no client
        if (withClient || description !== GetOption.Matching) {
          let model: M

          // This beforeEach needs to be inside the above if statement to avoid:
          // Invalid: beforeEach() may not be used in a describe block containing no tests.
          beforeEach(async (): Promise<void> => {
            model = await createModel({
              client: withClient ? resourceClient : undefined
            })
          })
          describe.each`
            match    | description
            ${match} | ${GetOption.Matching}
            ${false} | ${GetOption.Conflicting}
          `('$description id', ({ match, description }): void => {
            let id: string
            beforeEach((): void => {
              id = description === GetOption.Matching ? model.id : uuid()
            })

            test(`${
              match ? '' : 'cannot '
            }get a model`, async (): Promise<void> => {
              await testGet(
                {
                  id,
                  client,
                  walletAddressId: model.walletAddressId
                },
                match ? model : undefined
              )
            })
          })
          test(`${
            match ? '' : 'cannot '
          }list model`, async (): Promise<void> => {
            if (testList && model.walletAddressId) {
              await testList(
                {
                  walletAddressId: model.walletAddressId,
                  client
                },
                match ? model : undefined
              )
            }
          })
        }
      })
    }
  )
}

type TestsOptions<M> = Omit<BaseTestsOptions<M>, 'testGet' | 'testList'> & {
  get: (options: GetOptions) => Promise<M | undefined>
  list: (options: ListOptions) => Promise<M[]>
}

export const getTests = <M extends WalletAddressSubresource>({
  createModel,
  get,
  list
}: TestsOptions<M>): void => {
  baseGetTests({
    createModel,
    testGet: (options, expectedMatch) =>
      expect(get(options)).resolves.toEqual(expectedMatch),
    // tests walletAddressId / client filtering
    testList: (options, expectedMatch) =>
      expect(list(options)).resolves.toEqual([expectedMatch])
  })

  // tests pagination
  let walletAddressId: string
  getPageTests({
    createModel: async () => {
      const model = await createModel({})
      walletAddressId = model.walletAddressId
      return model
    },
    getPage: (pagination, sortOrder) =>
      list({
        walletAddressId,
        pagination,
        sortOrder
      }),
    sortOrder: Math.random() < 0.5 ? SortOrder.Asc : SortOrder.Desc
  })
}

type RouteTestsOptions<M> = Omit<
  BaseTestsOptions<M>,
  'testGet' | 'testList'
> & {
  getWalletAddress: () => Promise<WalletAddress>
  get: (ctx: ReadContext | ReadContextWithAuthenticatedStatus) => Promise<void>
  getBody: (model: M, list?: boolean) => Record<string, unknown>
  list?: (ctx: ListContext) => Promise<void>
  urlPath: string
  sortOrder?: SortOrder
}

export const getRouteTests = <M extends WalletAddressSubresource>({
  getWalletAddress,
  createModel,
  get,
  getBody,
  list,
  urlPath,
  sortOrder
}: RouteTestsOptions<M>): void => {
  const testList = async (
    { walletAddressId, client }: ListOptions,
    expectedMatch?: M
  ) => {
    const walletAddress = await getWalletAddress()
    walletAddress.id = walletAddressId
    const ctx = setup<ListContext>({
      reqOpts: {
        headers: { Accept: 'application/json' },
        method: 'GET',
        url: urlPath
      },
      walletAddress,
      client,
      accessAction: client ? AccessAction.List : AccessAction.ListAll
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await expect(list!(ctx)).resolves.toBeUndefined()
    if (expectedMatch) {
      // TODO: https://github.com/interledger/open-payments/issues/191
      expect(ctx.response).toSatisfyApiSpec()
    }
    expect(ctx.body).toEqual({
      result: expectedMatch ? [getBody(expectedMatch, true)] : [],
      pagination: {
        hasPreviousPage: false,
        hasNextPage: false,
        startCursor: expectedMatch?.id,
        endCursor: expectedMatch?.id
      }
    })
  }

  baseGetTests({
    createModel,
    testGet: async ({ id, walletAddressId, client }, expectedMatch) => {
      const walletAddress = await getWalletAddress()
      walletAddress.id = walletAddressId
      const ctx = setup<ReadContext>({
        reqOpts: {
          headers: { Accept: 'application/json' },
          method: 'GET',
          url: `${urlPath}/${id}`
        },
        params: {
          id
        },
        walletAddress,
        client,
        accessAction: client ? AccessAction.Read : AccessAction.ReadAll
      })
      if (expectedMatch) {
        await expect(get(ctx)).resolves.toBeUndefined()
        expect(ctx.response).toSatisfyApiSpec()
        expect(ctx.body).toEqual(getBody(expectedMatch))
      } else {
        await expect(get(ctx)).rejects.toMatchObject({
          status: 404,
          message: 'Not Found'
        })
      }
    },
    // tests walletAddressId / client filtering
    testList: list && testList,
    sortOrder: sortOrder
  })

  if (list) {
    describe('Common list route pagination', (): void => {
      let models: M[]

      beforeEach(async (): Promise<void> => {
        models = []
        for (let i = 0; i < 3; i++) {
          models.push(await createModel({}))
        }
        if (sortOrder === SortOrder.Desc) {
          models.reverse()
        }
      })

      test.each`
        query            | cursorIndex | pagination                                        | startIndex | endIndex | description
        ${{}}            | ${-1}       | ${{ hasPreviousPage: false, hasNextPage: false }} | ${0}       | ${2}     | ${'no pagination parameters'}
        ${{ first: 2 }}  | ${-1}       | ${{ hasPreviousPage: false, hasNextPage: true }}  | ${0}       | ${1}     | ${'only `first`'}
        ${{ first: 10 }} | ${0}        | ${{ hasPreviousPage: true, hasNextPage: false }}  | ${1}       | ${2}     | ${'`first` plus `cursor`'}
        ${{ last: 10 }}  | ${2}        | ${{ hasPreviousPage: false, hasNextPage: true }}  | ${0}       | ${1}     | ${'`last` plus `cursor`'}
      `(
        'returns 200 on $description',
        async ({
          query,
          cursorIndex,
          pagination,
          startIndex,
          endIndex
        }): Promise<void> => {
          const cursor = models[cursorIndex]?.id
          if (cursor) {
            query['cursor'] = cursor
          }
          pagination['startCursor'] = models[startIndex].id
          pagination['endCursor'] = models[endIndex].id
          const ctx = setup<ListContext>({
            reqOpts: {
              headers: { Accept: 'application/json' },
              method: 'GET',
              query,
              url: urlPath
            },
            walletAddress: await getWalletAddress(),
            accessAction: AccessAction.ListAll
          })
          await expect(list(ctx)).resolves.toBeUndefined()
          expect(ctx.response).toSatisfyApiSpec()
          expect(ctx.body).toEqual({
            pagination,
            result: models
              .slice(startIndex, endIndex + 1)
              .map((model) => getBody(model, true))
          })
        }
      )

      test.each`
        query                      | message                                    | description
        ${{ first: 10, last: 10 }} | ${'first and last are mutually exclusive'} | ${'`first` with `last`'}
        ${{ last: 10 }}            | ${'last requires cursor'}                  | ${'`last` without `cursor`'}
      `(
        'returns 400 on $description',
        async ({ query, message }): Promise<void> => {
          const ctx = setup<ListContext>({
            reqOpts: {
              headers: { Accept: 'application/json' },
              method: 'GET',
              query,
              url: urlPath
            },
            walletAddress: await getWalletAddress(),
            accessAction: AccessAction.ListAll
          })
          await expect(list(ctx)).rejects.toMatchObject({
            status: 400,
            message
          })
        }
      )
    })
  }
}

describe('Wallet Address Model', (): void => {
  let deps: IocContract<AppServices>
  let appContainer: TestContainer

  beforeAll(async (): Promise<void> => {
    deps = initIocContainer(Config)
    appContainer = await createTestApp(deps)
  })

  afterEach(async (): Promise<void> => {
    await truncateTables(appContainer.knex)
  })

  afterAll(async (): Promise<void> => {
    await appContainer.shutdown()
  })

  describe('deactivatedAt', () => {
    const getDateRelativeToToday = (daysFromToday: number) => {
      const d = new Date()
      d.setDate(d.getDate() + daysFromToday)
      return d
    }

    const deactivatedAtCases = [
      {
        value: null,
        expectedIsActive: true,
        description: 'No deactivatedAt is active'
      },
      {
        value: getDateRelativeToToday(1),
        expectedIsActive: true,
        description: 'Future deactivatedAt is inactive'
      },
      {
        value: getDateRelativeToToday(-1),
        expectedIsActive: false,
        description: 'Past deactivatedAt is inactive'
      }
    ]

    test.each(deactivatedAtCases)(
      '$description',
      async ({ value, expectedIsActive }) => {
        const walletAddress = await createWalletAddress(deps)
        if (value) {
          await walletAddress
            .$query(appContainer.knex)
            .patch({ deactivatedAt: value })
          assert.ok(walletAddress.deactivatedAt === value)
        }
        expect(walletAddress.isActive).toEqual(expectedIsActive)
      }
    )
  })
})
