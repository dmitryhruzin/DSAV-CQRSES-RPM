import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetCarMainByIdQuery } from '../queries/index.js'
import { GetCarMainByIdQueryHandler } from './GetCarMainByIdQueryHandler.js'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('GetCarMainByIdQueryHandler', () => {
  describe('execute', () => {
    let repository: CarMainProjection
    let handler: GetCarMainByIdQueryHandler

    beforeEach(() => {
      repository = new CarMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.getById = jest.fn() as jest.Mocked<typeof repository.getById>
      handler = new GetCarMainByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetCarMainByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getById).toHaveBeenCalledWith(expected)
    })
  })
})
