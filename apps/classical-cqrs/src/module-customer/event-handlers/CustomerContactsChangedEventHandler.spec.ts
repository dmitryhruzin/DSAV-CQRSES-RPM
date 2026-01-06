import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerContactsChangedV1 } from '../events/index.js'
import { CustomerContactsChangedEventHandler } from './CustomerContactsChangedEventHandler.js'
import { CustomerWithCarsProjection, CustomerMainProjection } from '../projections/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('CustomerContactsChangedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let repositoryWithCars: CustomerWithCarsProjection
    let handler: CustomerContactsChangedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>

      repositoryWithCars = new CustomerWithCarsProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repositoryWithCars.updateCustomer = jest.fn() as jest.Mocked<typeof repositoryWithCars.updateCustomer>

      handler = new CustomerContactsChangedEventHandler(repository, repositoryWithCars)
    })

    const testCases = [
      {
        description: 'should call repository with CustomerContactsChangedV1 event',
        payload: new CustomerContactsChangedV1({
          previousEmail: 'oldEmail@example.com',
          previousPhoneNumber: '+1234567890',
          email: 'newEmail@example.com',
          phoneNumber: '+0987654321',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { email: 'newEmail@example.com', phoneNumber: '+0987654321', version: 1 },
        withCarsExpectedPayload: { email: 'newEmail@example.com', phoneNumber: '+0987654321', customerVersion: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload, withCarsExpectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
      expect(repositoryWithCars.updateCustomer).toHaveBeenCalledWith(expectedId, withCarsExpectedPayload)
    })
  })
})
