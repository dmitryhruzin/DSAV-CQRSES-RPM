import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerRoleChangedEventHandler } from './WorkerRoleChangedEventHandler.js'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerRoleChangedV1 } from '../events/index.js'

describe('WorkerRoleChangedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkerMainProjection
    let handler: WorkerRoleChangedEventHandler

    beforeEach(() => {
      repository = new WorkerMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkerRoleChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkerRoleChangedV1 event',
        payload: new WorkerRoleChangedV1({
          previousRole: 'oldRole',
          role: 'newRole',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { role: 'newRole', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
