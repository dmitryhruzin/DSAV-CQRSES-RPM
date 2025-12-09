import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetUserMainByIdQuery } from '../queries/index.js'
import { GetUserMainByIdQueryHandler } from './GetUserMainByIdQueryHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'

describe('GetUserByIdMainQueryHandler', () => {
  describe('execute', () => {
    let repository: UserMainProjection
    let handler: GetUserMainByIdQueryHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as knex.Knex, {} as Logger)
      repository.getById = jest.fn() as jest.Mocked<typeof repository.getById>
      handler = new GetUserMainByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetUserMainByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getById).toHaveBeenCalledWith(expected)
    })
  })
})
