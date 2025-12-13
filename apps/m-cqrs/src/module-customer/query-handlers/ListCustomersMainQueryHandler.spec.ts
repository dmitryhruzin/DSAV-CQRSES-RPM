import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListCustomersMainQueryHandler } from './ListCustomersMainQueryHandler.js'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { ListCustomersMainQuery } from '../queries/index.js'

describe('ListCustomersMainQueryHandler', () => {
  describe('execute', () => {
    let repository: CustomerMainProjection
    let handler: ListCustomersMainQueryHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListCustomersMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListCustomersMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
