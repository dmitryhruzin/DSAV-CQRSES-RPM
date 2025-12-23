import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkStatusChangedV1 } from '../events/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { WorkStatusChangedEventHandler } from './WorkStatusChangedEventHandler.js'
import { STATUS } from '../../constants/work.js'

describe('WorkStatusChangedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkStatusChangedEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkStatusChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkStatusChangedV1 event',
        payload: new WorkStatusChangedV1({
          previousStatus: STATUS.TODO,
          status: STATUS.IN_PROGRESS,
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { status: STATUS.IN_PROGRESS, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
