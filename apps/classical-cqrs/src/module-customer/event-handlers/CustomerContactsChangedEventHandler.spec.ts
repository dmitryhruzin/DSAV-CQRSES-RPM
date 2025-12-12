import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { CustomerContactsChangedV1 } from '../events/index.js'
import { CustomerContactsChangedEventHandler } from './CustomerContactsChangedEventHandler.js'

describe('CustomerContactsChangedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let handler: CustomerContactsChangedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new CustomerContactsChangedEventHandler(repository)
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
        expectedPayload: { email: 'newEmail@example.com', phoneNumber: '+0987654321', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
