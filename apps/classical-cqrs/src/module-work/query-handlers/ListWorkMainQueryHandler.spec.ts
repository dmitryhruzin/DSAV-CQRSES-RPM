import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListWorkMainQueryHandler } from './ListWorkMainQueryHandler.js'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { ListWorkMainQuery } from '../queries/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('ListWorkMainQueryHandler', () => {
  describe('execute', () => {
    let repository: WorkMainProjection
    let handler: ListWorkMainQueryHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListWorkMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListWorkMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
