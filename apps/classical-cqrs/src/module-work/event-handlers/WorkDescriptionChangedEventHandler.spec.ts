import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkDescriptionChangedV1 } from '../events/index.js'
import { WorkDescriptionChangedEventHandler } from './WorkDescriptionChangedEventHandler.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('WorkDescriptionChangedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkDescriptionChangedEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkDescriptionChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkDescriptionChangedV1 event',
        payload: new WorkDescriptionChangedV1({
          previousDescription: 'Old description',
          description: 'New description',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { description: 'New description', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
