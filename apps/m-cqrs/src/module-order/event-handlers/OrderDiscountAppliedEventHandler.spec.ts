import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderDiscountAppliedEventHandler } from './OrderDiscountAppliedEventHandler.js'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderDiscountAppliedV1 } from '../events/index.js'

describe('OrderDiscountAppliedEventHandler', () => {
  describe('handle', () => {
    let repository: OrderMainProjection
    let handler: OrderDiscountAppliedEventHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new OrderDiscountAppliedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with OrderDiscountAppliedV1 event',
        payload: new OrderDiscountAppliedV1({
          previousDiscount: '10.00',
          discount: '5.00',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { discount: '5.00', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
