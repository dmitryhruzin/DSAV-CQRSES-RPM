import { jest } from '@jest/globals'
import { CustomerCreatedEventHandler } from './CustomerCreatedEventHandler.js'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import knex from 'knex'
import { CustomerCreatedV1 } from '../events/index.js'
import { Logger } from '@DSAV-CQRSES-RPM/logger'

describe('CustomerCreatedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let handler: CustomerCreatedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new CustomerCreatedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new CustomerCreatedV1({
          id: '1',
          aggregateId: '1234',
          aggregateVersion: 1,
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '123-456-7890'
        }),
        expected: {
          id: '1',
          version: 1,
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '123-456-7890'
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
