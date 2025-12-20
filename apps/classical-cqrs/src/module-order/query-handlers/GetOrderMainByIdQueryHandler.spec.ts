import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { GetOrderMainByIdQuery } from '../queries/index.js'
import { GetOrderMainByIdQueryHandler } from './GetOrderMainByIdQueryHandler.js'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('GetOrderMainByIdQueryHandler', () => {
  describe('execute', () => {
    let repository: OrderMainProjection
    let handler: GetOrderMainByIdQueryHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.getById = jest.fn() as jest.Mocked<typeof repository.getById>
      handler = new GetOrderMainByIdQueryHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific ID',
        payload: new GetOrderMainByIdQuery('1'),
        expected: '1'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.getById).toHaveBeenCalledWith(expected)
    })
  })
})
