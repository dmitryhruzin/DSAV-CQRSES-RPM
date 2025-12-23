import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkCreatedV1 } from '../events/index.js'
import { WorkCreatedEventHandler } from './WorkCreatedEventHandler.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { STATUS } from '../../constants/work.js'

describe('WorkCreatedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkCreatedEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new WorkCreatedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new WorkCreatedV1({
          id: '1',
          aggregateId: '1234',
          aggregateVersion: 1,
          title: 'Test Work',
          description: 'This is a test work',
          status: STATUS.TODO
        }),
        expected: {
          id: '1',
          version: 1,
          title: 'Test Work',
          description: 'This is a test work',
          status: STATUS.TODO
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
