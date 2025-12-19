import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListOrdersMainQueryHandler } from './ListOrdersMainQueryHandler.js'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { ListOrdersMainQuery } from '../queries/index.js'

describe('ListOrdersMainQueryHandler', () => {
  describe('execute', () => {
    let repository: OrderMainProjection
    let handler: ListOrdersMainQueryHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListOrdersMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListOrdersMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
