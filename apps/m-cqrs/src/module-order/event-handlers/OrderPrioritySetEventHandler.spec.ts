import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderPrioritySetV1 } from '../events/index.js'
import { OrderPrioritySetEventHandler } from './OrderPrioritySetEventHandler.js'

describe('OrderPrioritySetEventHandler', () => {
  describe('handle', () => {
    let repository: OrderMainProjection
    let handler: OrderPrioritySetEventHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new OrderPrioritySetEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with OrderPrioritySetV1 event',
        payload: new OrderPrioritySetV1({
          previousPriority: 1,
          priority: 2,
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { priority: 2, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
