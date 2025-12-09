import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListUsersMainQueryHandler } from './ListUsersMainQueryHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { ListUsersMainQuery } from '../queries/index.js'

describe('GetUsersMainQueryHandler', () => {
  describe('execute', () => {
    let repository: UserMainProjection
    let handler: ListUsersMainQueryHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListUsersMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListUsersMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
