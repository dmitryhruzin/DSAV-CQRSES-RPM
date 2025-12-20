import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderCreatedV1 } from '../events/index.js'
import { OrderCreatedEventHandler } from './OrderCreatedEventHandler.js'
import { STATUS } from '../../constants/order.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('OrderCreatedEventHandler', () => {
  describe('handle', () => {
    let repository: OrderMainProjection
    let handler: OrderCreatedEventHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new OrderCreatedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new OrderCreatedV1({
          id: '1',
          aggregateId: '1234',
          aggregateVersion: 1,
          title: 'Test Order',
          price: '20.00',
          discount: '5.00',
          priority: 2,
          status: STATUS.TODO,
          approved: false
        }),
        expected: {
          id: '1',
          version: 1,
          title: 'Test Order',
          price: '20.00',
          discount: '5.00',
          priority: 2,
          status: STATUS.TODO,
          approved: false
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
