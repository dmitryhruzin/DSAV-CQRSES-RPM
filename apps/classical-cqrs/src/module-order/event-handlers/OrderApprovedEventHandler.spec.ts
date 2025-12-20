import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderApprovedEventHandler } from './OrderApprovedEventHandler.js'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderApprovedV1 } from '../events/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('OrderApprovedEventHandler', () => {
  describe('handle', () => {
    let repository: OrderMainProjection
    let handler: OrderApprovedEventHandler

    beforeEach(() => {
      repository = new OrderMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new OrderApprovedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with OrderApprovedV1 event',
        payload: new OrderApprovedV1({
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { approved: true, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
