import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerDismissedV1 } from '../events/index.js'
import { WorkerDismissedEventHandler } from './WorkerDismissedEventHandler.js'

describe('WorkerDismissedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkerMainProjection
    let handler: WorkerDismissedEventHandler

    beforeEach(() => {
      repository = new WorkerMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkerDismissedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkerDismissedV1 event',
        payload: new WorkerDismissedV1({
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
