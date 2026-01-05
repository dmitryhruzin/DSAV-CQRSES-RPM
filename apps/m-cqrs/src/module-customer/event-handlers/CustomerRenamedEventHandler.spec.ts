import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerRenamedEventHandler } from './CustomerRenamedEventHandler.js'
import { CustomerMainProjection, CustomerWithCarsProjection } from '../projections/index.js'
import { CustomerRenamedV1 } from '../events/index.js'

describe('CustomerRenamedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let repositoryWithCars: CustomerWithCarsProjection
    let handler: CustomerRenamedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>

      repositoryWithCars = new CustomerWithCarsProjection({} as knex.Knex, {} as Logger)
      repositoryWithCars.updateCustomer = jest.fn() as jest.Mocked<typeof repositoryWithCars.updateCustomer>

      handler = new CustomerRenamedEventHandler(repository, repositoryWithCars)
    })

    const testCases = [
      {
        description: 'should call repository with CustomerRenamedV1 event',
        payload: new CustomerRenamedV1({
          previousFirstName: 'oldFirstName',
          previousLastName: 'oldLastName',
          firstName: 'newFirstName',
          lastName: 'newLastName',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { firstName: 'newFirstName', lastName: 'newLastName', version: 1 },
        withCarsExpectedPayload: { firstName: 'newFirstName', lastName: 'newLastName', customerVersion: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload, withCarsExpectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
      expect(repositoryWithCars.updateCustomer).toHaveBeenCalledWith(expectedId, withCarsExpectedPayload)
    })
  })
})
