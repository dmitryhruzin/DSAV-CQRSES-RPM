import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListWorkersMainQueryHandler } from './ListOrdersMainQueryHandler.js'
import { WorkerMainProjection } from '../projections/order-main.projection.js'
import { ListWorkersMainQuery } from '../queries/index.js'

describe('ListWorkersMainQueryHandler', () => {
  describe('execute', () => {
    let repository: WorkerMainProjection
    let handler: ListWorkersMainQueryHandler

    beforeEach(() => {
      repository = new WorkerMainProjection({} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListWorkersMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListWorkersMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
