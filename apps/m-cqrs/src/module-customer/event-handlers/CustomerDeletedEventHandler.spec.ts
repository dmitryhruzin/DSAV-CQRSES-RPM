import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { CustomerDeletedV1 } from '../events/index.js'
import { CustomerDeletedEventHandler } from './CustomerDeletedEventHandler.js'

describe('CustomerDeletedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerMainProjection
    let handler: CustomerDeletedEventHandler

    beforeEach(() => {
      repository = new CustomerMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new CustomerDeletedEventHandler(repository)
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
        expectedPayload: { deletedAt: expect.any(Date), version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
