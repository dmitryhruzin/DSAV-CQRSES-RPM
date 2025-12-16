import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerHiredV1 } from '../events/index.js'
import { WorkerHiredEventHandler } from './WorkerHiredEventHandler.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('WorkerHiredEventHandler', () => {
  describe('handle', () => {
    let repository: WorkerMainProjection
    let handler: WorkerHiredEventHandler

    beforeEach(() => {
      repository = new WorkerMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new WorkerHiredEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new WorkerHiredV1({
          id: '1',
          aggregateId: '1234',
          aggregateVersion: 1,
          hourlyRate: '20.00',
          role: 'manager'
        }),
        expected: {
          id: '1',
          version: 1,
          hourlyRate: '20.00',
          role: 'manager'
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
