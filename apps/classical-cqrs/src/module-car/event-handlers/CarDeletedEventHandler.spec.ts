import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { CarDeletedV1 } from '../events/index.js'
import { CarDeletedEventHandler } from './CarDeletedEventHandler.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('CarDeletedEventHandler', () => {
  describe('handle', () => {
    let repository: CarMainProjection
    let handler: CarDeletedEventHandler

    beforeEach(() => {
      repository = new CarMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
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
        expectedPayload: { deletedAt: expect.any(Date), version: 2 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
