import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerWithCarsProjection } from '../projections/index.js'
import { CarDeletedV1 } from '../../module-car/events/index.js'
import { CarDeletedEventHandler } from './CarDeletedEventHandler.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('CarDeletedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerWithCarsProjection
    let handler: CarDeletedEventHandler

    beforeEach(() => {
      repository = new CustomerWithCarsProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.updateCar = jest.fn() as jest.Mocked<typeof repository.updateCar>
      handler = new CarDeletedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with CarDeletedV1 event',
        payload: new CarDeletedV1({
          deletedAt: new Date(),
          aggregateId: '1234',
          aggregateVersion: 2
        }),
        expectedId: '1234',
        expectedPayload: { carDeletedAt: expect.any(Date), carVersion: 2 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.updateCar).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
