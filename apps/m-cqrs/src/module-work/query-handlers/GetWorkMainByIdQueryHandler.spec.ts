import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetWorkMainByIdQuery } from '../queries/index.js'
import { GetWorkMainByIdQueryHandler } from './GetWorkMainByIdQueryHandler.js'
import { WorkMainProjection } from '../projections/work-main.projection.js'

describe('GetWorkMainByIdQueryHandler', () => {
  describe('execute', () => {
    let repository: WorkMainProjection
    let handler: GetWorkMainByIdQueryHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as knex.Knex, {} as Logger)
      repository.getById = jest.fn() as jest.Mocked<typeof repository.getById>
      handler = new GetWorkMainByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetWorkMainByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getById).toHaveBeenCalledWith(expected)
    })
  })
})
