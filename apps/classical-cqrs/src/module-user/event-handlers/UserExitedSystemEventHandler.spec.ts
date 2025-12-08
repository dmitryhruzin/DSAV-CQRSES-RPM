import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { UserExitedSystemEventHandler } from './UserExitedSystemEventHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { UserExitedSystemV1 } from '../events/index.js'

describe('UserExitedSystemEventHandler', () => {
  describe('handle', () => {
    let repository: UserMainProjection
    let handler: UserExitedSystemEventHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new UserExitedSystemEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with UserExitedSystemV1 event',
        payload: new UserExitedSystemV1({ aggregateId: '1234', aggregateVersion: 1 }),
        expectedId: '1234',
        expectedPayload: { isInSystem: false, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
