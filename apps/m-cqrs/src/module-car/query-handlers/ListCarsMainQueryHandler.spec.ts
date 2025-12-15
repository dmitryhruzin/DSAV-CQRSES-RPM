import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { ListCarsMainQueryHandler } from './ListCarsMainQueryHandler.js'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { ListCarsMainQuery } from '../queries/index.js'

describe('ListCarsMainQueryHandler', () => {
  describe('execute', () => {
    let repository: CarMainProjection
    let handler: ListCarsMainQueryHandler

    beforeEach(() => {
      repository = new CarMainProjection({} as knex.Knex, {} as Logger)
      repository.getAll = jest.fn() as jest.Mocked<typeof repository.getAll>
      handler = new ListCarsMainQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository',
        payload: new ListCarsMainQuery(1, 10)
      }
    ]
    test.each(testCases)('$description', async ({ payload }) => {
      await handler.execute(payload)

      expect(repository.getAll).toHaveBeenCalledTimes(1)
    })
  })
})
