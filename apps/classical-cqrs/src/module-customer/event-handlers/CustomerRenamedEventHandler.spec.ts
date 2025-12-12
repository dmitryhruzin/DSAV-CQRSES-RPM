import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerRenamedEventHandler } from './CustomerRenamedEventHandler.js'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { CustomerRenamedV1 } from '../events/index.js'

describe('CustomerRenamedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let handler: CustomerRenamedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new CustomerRenamedEventHandler(repository)
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
        expectedPayload: { firstName: 'newFirstName', lastName: 'newLastName', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
