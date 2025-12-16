import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetWorkerMainByIdQuery } from '../queries/index.js'
import { GetWorkerMainByIdQueryHandler } from './GetWorkerMainByIdQueryHandler.js'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('GetWorkerMainByIdQueryHandler', () => {
  describe('execute', () => {
    let repository: WorkerMainProjection
    let handler: GetWorkerMainByIdQueryHandler

    beforeEach(() => {
      repository = new WorkerMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.getById = jest.fn() as jest.Mocked<typeof repository.getById>
      handler = new GetWorkerMainByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetWorkerMainByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getById).toHaveBeenCalledWith(expected)
    })
  })
})
