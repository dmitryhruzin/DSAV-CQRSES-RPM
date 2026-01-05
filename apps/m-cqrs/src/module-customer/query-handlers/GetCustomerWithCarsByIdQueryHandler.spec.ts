import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetCustomerWithCarsByIdQuery } from '../queries/index.js'
import { GetCustomerWithCarsByIdQueryHandler } from './index.js'
import { CustomerWithCarsProjection } from '../projections/index.js'

describe('GetCustomerWithCarsByIdQueryHandler', () => {
  describe('execute', () => {
    let repository: CustomerWithCarsProjection
    let handler: GetCustomerWithCarsByIdQueryHandler

    beforeEach(() => {
      repository = new CustomerWithCarsProjection({} as knex.Knex, {} as Logger)
      repository.getByCustomerId = jest.fn() as jest.Mocked<typeof repository.getByCustomerId>
      handler = new GetCustomerWithCarsByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetCustomerWithCarsByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getByCustomerId).toHaveBeenCalledWith(expected)
    })
  })
})
