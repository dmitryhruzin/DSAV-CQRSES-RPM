import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderPriceChangedV1 } from '../events/index.js'
import { OrderPriceChangedEventHandler } from './OrderPriceChangedEventHandler.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('OrderPriceChangedEventHandler', () => {
  describe('handle', () => {
    let repository: OrderMainProjection
    let handler: OrderPriceChangedEventHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new OrderPriceChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with OrderPriceChangedV1 event',
        payload: new OrderPriceChangedV1({
          previousPrice: '50.00',
          price: '100.00',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { price: '100.00', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
