import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkAddedToOrderV1 } from '../events/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { WorkAddedToOrderEventHandler } from './WorkAddedToOrderEventHandler.js'

describe('WorkAddedToOrderEventHandler', () => {
  describe('handle', () => {
    let repository: WorkMainProjection
    let handler: WorkAddedToOrderEventHandler

    beforeEach(() => {
      repository = new WorkMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkAddedToOrderEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkAddedToOrderV1 event',
        payload: new WorkAddedToOrderV1({
          orderID: 'New Order',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { orderID: 'New Order', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
