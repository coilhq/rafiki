import { BaseModel, Pagination, SortOrder } from './baseModel'
import { getPageInfo } from './pagination'

interface PageTestsOptions<Type> {
  createModel: () => Promise<Type>
  getPage: (pagination?: Pagination, sortOrder?: SortOrder) => Promise<Type[]>
}

export const getPageTests = <Type extends BaseModel>({
  createModel,
  getPage
}: PageTestsOptions<Type>): void => {
  describe('Common BaseModel pagination', (): void => {
    let modelsCreatedAsc: Type[]
    let modelsCreatedDesc: Type[]

    beforeEach(async (): Promise<void> => {
      modelsCreatedAsc = []
      modelsCreatedDesc = []
      for (let i = 0; i < 22; i++) {
        const model = await createModel()
        modelsCreatedAsc.push(model)
        modelsCreatedDesc[21 - i] = model
      }
    })

    test.each`
      pagination                  | expected                               | description
      ${undefined}                | ${{ length: 20, first: 0, last: 19 }}  | ${'Defaults to fetching first 20 items'}
      ${{ first: 10 }}            | ${{ length: 10, first: 0, last: 9 }}   | ${'Can change forward pagination limit'}
      ${{ after: 0 }}             | ${{ length: 20, first: 1, last: 20 }}  | ${'Can paginate forwards from a cursor'}
      ${{ first: 10, after: 9 }}  | ${{ length: 10, first: 10, last: 19 }} | ${'Can paginate forwards from a cursor with a limit'}
      ${{ before: 20 }}           | ${{ length: 20, first: 0, last: 19 }}  | ${'Can paginate backwards from a cursor'}
      ${{ last: 5, before: 10 }}  | ${{ length: 5, first: 5, last: 9 }}    | ${'Can paginate backwards from a cursor with a limit'}
      ${{ after: 0, before: 19 }} | ${{ length: 20, first: 1, last: 20 }}  | ${'Providing before and after results in forward pagination'}
    `('$description', async ({ pagination, expected }): Promise<void> => {
      if (pagination?.after !== undefined) {
        pagination.after = modelsCreatedDesc[pagination.after].id
      }
      if (pagination?.before !== undefined) {
        pagination.before = modelsCreatedDesc[pagination.before].id
      }
      const models = await getPage(pagination)
      expect(models).toHaveLength(expected.length)
      expect(models[0].id).toEqual(modelsCreatedDesc[expected.first].id)
      expect(models[expected.length - 1].id).toEqual(
        modelsCreatedDesc[expected.last].id
      )
    })

    test.each`
      pagination        | expectedError                                 | description
      ${{ last: 10 }}   | ${"Can't paginate backwards from the start."} | ${"Can't change backward pagination limit on it's own."}
      ${{ first: -1 }}  | ${'Pagination index error'}                   | ${"Can't request less than 0"}
      ${{ first: 101 }} | ${'Pagination index error'}                   | ${"Can't request more than 100"}
    `('$description', async ({ pagination, expectedError }): Promise<void> => {
      await expect(getPage(pagination)).rejects.toThrow(expectedError)
    })

    test.each`
      order             | description
      ${SortOrder.Asc}  | ${'Backwards/Forwards pagination results in same order for ASC.'}
      ${SortOrder.Desc} | ${'Backwards/Forwards pagination results in same order for DESC.'}
    `('$description', async ({ order }): Promise<void> => {
      const models =
        order === SortOrder.Asc ? modelsCreatedAsc : modelsCreatedDesc

      const paginationForwards = {
        first: 10
      }
      const modelsForwards = await getPage(paginationForwards, order)
      const paginationBackwards = {
        last: 10,
        before: models[10].id
      }
      const modelsBackwards = await getPage(paginationBackwards, order)
      expect(modelsForwards).toHaveLength(10)
      expect(modelsBackwards).toHaveLength(10)
      expect(modelsForwards).toEqual(modelsBackwards)
    })

    test.each`
      pagination       | cursor  | start | end   | hasNextPage | hasPreviousPage | sortOrder
      ${null}          | ${null} | ${0}  | ${19} | ${true}     | ${false}        | ${SortOrder.Desc}
      ${{ first: 5 }}  | ${null} | ${0}  | ${4}  | ${true}     | ${false}        | ${SortOrder.Desc}
      ${{ first: 22 }} | ${null} | ${0}  | ${21} | ${false}    | ${false}        | ${SortOrder.Desc}
      ${{ first: 3 }}  | ${3}    | ${4}  | ${6}  | ${true}     | ${true}         | ${SortOrder.Desc}
      ${{ last: 5 }}   | ${9}    | ${4}  | ${8}  | ${true}     | ${true}         | ${SortOrder.Desc}
      ${null}          | ${null} | ${0}  | ${19} | ${true}     | ${false}        | ${SortOrder.Asc}
      ${{ first: 5 }}  | ${null} | ${0}  | ${4}  | ${true}     | ${false}        | ${SortOrder.Asc}
      ${{ first: 22 }} | ${null} | ${0}  | ${21} | ${false}    | ${false}        | ${SortOrder.Asc}
      ${{ first: 3 }}  | ${3}    | ${4}  | ${6}  | ${true}     | ${true}         | ${SortOrder.Asc}
      ${{ last: 5 }}   | ${9}    | ${4}  | ${8}  | ${true}     | ${true}         | ${SortOrder.Asc}
    `(
      'pagination $pagination with cursor $cursor in $sortOrder order',
      async ({
        pagination,
        cursor,
        start,
        end,
        hasNextPage,
        hasPreviousPage,
        sortOrder
      }): Promise<void> => {
        const models =
          sortOrder === SortOrder.Asc ? modelsCreatedAsc : modelsCreatedDesc
        if (cursor) {
          if (pagination.last) pagination.before = models[cursor].id
          else pagination.after = models[cursor].id
        }

        const page = await getPage(pagination, sortOrder)
        const pageInfo = await getPageInfo(
          (pagination, sortOrder) => getPage(pagination, sortOrder),
          page,
          sortOrder
        )
        expect(pageInfo).toEqual({
          startCursor: models[start].id,
          endCursor: models[end].id,
          hasNextPage,
          hasPreviousPage
        })
      }
    )
  })
}

test.todo('test suite must contain at least one test')
