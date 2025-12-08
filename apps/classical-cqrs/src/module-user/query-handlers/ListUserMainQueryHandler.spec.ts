import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListUserMainQueryHandler } from './ListUserMainQueryHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { ListUserMainQuery } from '../queries/index.js'

describe('GetUsersMainQueryHandler', () => {
  describe('execute', () => {
    let repository: UserMainProjection
    let handler: ListUserMainQueryHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListUserMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListUserMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
