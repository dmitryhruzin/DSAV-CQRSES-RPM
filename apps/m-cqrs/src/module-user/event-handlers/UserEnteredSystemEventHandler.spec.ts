import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { UserEnteredSystemEventHandler } from './UserEnteredSystemEventHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { UserEnteredSystemV1 } from '../events/index.js'

describe('UserEnteredSystemEventHandler', () => {
  describe('handle', () => {
    let repository: UserMainProjection
    let handler: UserEnteredSystemEventHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new UserEnteredSystemEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with UserEnteredSystemV1 event',
        payload: new UserEnteredSystemV1({ aggregateId: '1234', aggregateVersion: 1 }),
        expectedId: '1234',
        expectedPayload: { isInSystem: true, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
