import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkUnassignedFromWorkerV1 } from '../events/index.js'
import { WorkUnassignedFromWorkerEventHandler } from './WorkUnassignedFromWorkerEventHandler.js'

describe('WorkUnassignedFromWorkerEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkUnassignedFromWorkerEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkUnassignedFromWorkerEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkUnassignedFromWorkerV1 event',
        payload: new WorkUnassignedFromWorkerV1({
          previousWorkerID: 'Old Worker',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { assignedTo: null, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
