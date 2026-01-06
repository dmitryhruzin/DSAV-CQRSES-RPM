import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerDeletedV1 } from '../events/index.js'
import { CustomerDeletedEventHandler } from './CustomerDeletedEventHandler.js'
import { CustomerWithCarsProjection, CustomerMainProjection } from '../projections/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('CustomerDeletedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let repositoryWithCars: CustomerWithCarsProjection
    let handler: CustomerDeletedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>

      repositoryWithCars = new CustomerWithCarsProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repositoryWithCars.updateCustomer = jest.fn() as jest.Mocked<typeof repositoryWithCars.updateCustomer>

      handler = new CustomerDeletedEventHandler(repository, repositoryWithCars)
    })

    const testCases = [
      {
        description: 'should call repository with CustomerDeletedV1 event',
        payload: new CustomerDeletedV1({
          deletedAt: new Date(),
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { deletedAt: expect.any(Date), version: 1 },
        withCarsExpectedPayload: { customerDeletedAt: expect.any(Date), customerVersion: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload, withCarsExpectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
      expect(repositoryWithCars.updateCustomer).toHaveBeenCalledWith(expectedId, withCarsExpectedPayload)
    })
  })
})
