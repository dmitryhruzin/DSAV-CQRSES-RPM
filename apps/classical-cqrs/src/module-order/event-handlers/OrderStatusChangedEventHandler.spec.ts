import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderStatusChangedV1 } from '../events/index.js'
import { OrderStatusChangedEventHandler } from './OrderStatusChangedEventHandler.js'
import { STATUS } from '../../constants/order.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('OrderStatusChangedEventHandler', () => {
  describe('handle', () => {
    let repository: OrderMainProjection
    let handler: OrderStatusChangedEventHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new OrderStatusChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with OrderStatusChangedV1 event',
        payload: new OrderStatusChangedV1({
          previousStatus: STATUS.TODO,
          status: STATUS.IN_PROGRESS,
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { status: STATUS.IN_PROGRESS, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
