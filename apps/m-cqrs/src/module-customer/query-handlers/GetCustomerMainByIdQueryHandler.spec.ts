import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetCustomerMainByIdQuery } from '../queries/index.js'
import { GetCustomerMainByIdQueryHandler } from './GetCustomerMainByIdQueryHandler.js'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('GetCustomerMainByIdQueryHandler', () => {
  describe('execute', () => {
    let repository: CustomerMainProjection
    let handler: GetCustomerMainByIdQueryHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as knex.Knex, {} as Logger)
      repository.getById = jest.fn() as jest.Mocked<typeof repository.getById>
      handler = new GetCustomerMainByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetCustomerMainByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getById).toHaveBeenCalledWith(expected)
    })
  })
})
