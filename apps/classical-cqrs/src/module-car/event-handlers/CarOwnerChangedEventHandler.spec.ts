import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CarOwnerChangedEventHandler } from './CarOwnerChangedEventHandler.js'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { CarOwnerChangedV1 } from '../events/index.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'

describe('CarOwnerChangedEventHandler', () => {
  describe('handle', () => {
    let repository: CarMainProjection
    let handler: CarOwnerChangedEventHandler

    beforeEach(() => {
      repository = new CarMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new CarOwnerChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with CarOwnerChangedV1 event',
        payload: new CarOwnerChangedV1({
          previousOwnerID: 'oldOwnerID',
          ownerID: 'newOwnerID',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { ownerID: 'newOwnerID', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
