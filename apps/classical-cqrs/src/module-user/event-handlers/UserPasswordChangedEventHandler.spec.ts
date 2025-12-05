import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { UserPasswordChangedEventHandler } from './UserPasswordChangedEventHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store-module/event-store.repository.js'
import { UserPasswordChangedV1 } from '../events/index.js'
import { version } from 'uuid'

describe('UserPasswordChangedEventHandler', () => {
  describe('handle', () => {
    let repository: UserMainProjection
    let handler: UserPasswordChangedEventHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new UserPasswordChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with UserPasswordChangedV1 event',
        payload: new UserPasswordChangedV1({ previousPassword: 'oldPassword', password: 'newPassword', aggregateId: '1234', aggregateVersion: 1 }),
        expectedId: '1234',
        expectedPayload: { password: 'newPassword', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
