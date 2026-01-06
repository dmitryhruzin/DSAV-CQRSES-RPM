import { jest } from '@jest/globals'
import { CarCreatedEventHandler } from './CarCreatedEventHandler.js'
import { CustomerWithCarsProjection } from '../projections/index.js'
import knex from 'knex'
import { CarCreatedV1 } from '../../module-car/events/index.js'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('CarCreatedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerWithCarsProjection
    let handler: CarCreatedEventHandler

    beforeEach(() => {
      repository = new CustomerWithCarsProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new CarCreatedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new CarCreatedV1({
          id: '1',
          aggregateId: '1234',
          aggregateVersion: 1,
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'ABC123',
          mileage: 10000,
          owner: { id: '1', version: 1, userID: 'user1', firstName: 'John', lastName: 'Doe' }
        }),
        expected: {
          carID: '1',
          carVersion: 1,
          vin: '1HGCM82633A123456',
          registrationNumber: 'ABC123',
          mileage: 10000,
          customerID: '1',
          customerVersion: 1,
          userID: 'user1',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
