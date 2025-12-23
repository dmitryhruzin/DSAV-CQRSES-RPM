import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkTitleChangedEventHandler } from './WorkTitleChangedEventHandler.js'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkTitleChangedV1 } from '../events/index.js'

describe('WorkTitleChangedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkTitleChangedEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkTitleChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkTitleChangedV1 event',
        payload: new WorkTitleChangedV1({
          previousTitle: 'Old Title',
          title: 'New Title',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { title: 'New Title', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
