import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkRemovedFromOrderV1 } from '../events/index.js'
import { WorkRemovedFromOrderEventHandler } from './WorkRemovedFromOrderEventHandler.js'

describe('WorkRemovedFromOrderEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkRemovedFromOrderEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkRemovedFromOrderEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkRemovedFromOrderV1 event',
        payload: new WorkRemovedFromOrderV1({
          previousOrderID: 'Old Order',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { orderID: null, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
