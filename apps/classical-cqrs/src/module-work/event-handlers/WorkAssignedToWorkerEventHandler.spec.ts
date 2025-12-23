import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkAssignedToWorkerV1 } from '../events/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { WorkAssignedToWorkerEventHandler } from './WorkAssignedToWorkerEventHandler.js'

describe('WorkAssignedToWorkerEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkAssignedToWorkerEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkAssignedToWorkerEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkAssignedToWorkerV1 event',
        payload: new WorkAssignedToWorkerV1({
          previousWorkerID: 'Old Worker',
          workerID: 'New Worker',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { assignedTo: 'New Worker', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
