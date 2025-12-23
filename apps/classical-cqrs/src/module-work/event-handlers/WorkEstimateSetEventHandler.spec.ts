import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkEstimateSetV1 } from '../events/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { WorkEstimateSetEventHandler } from './WorkEstimateSetEventHandler.js'

describe('WorkEstimateSetEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkEstimateSetEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkEstimateSetEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkEstimateSetV1 event',
        payload: new WorkEstimateSetV1({
          previousEstimate: 'Old Estimate',
          estimate: 'New Estimate',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { estimate: 'New Estimate', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
