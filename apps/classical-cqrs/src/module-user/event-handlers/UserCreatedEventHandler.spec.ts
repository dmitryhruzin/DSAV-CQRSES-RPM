import { jest } from '@jest/globals'
import { UserCreatedEventHandler } from './UserCreatedEventHandler.js'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { EventStoreRepository } from '../../infra/event-store-module/event-store.repository.js'
import knex from 'knex'
import { UserCreatedV1 } from '../events/index.js'
import { Logger } from '@DSAV-CQRSES-RPM/logger'

describe('UserCreatedEventHandler', () => {
  describe('handle', () => {
    let repository: UserMainProjection
    let handler: UserCreatedEventHandler

    beforeEach(() => {
      repository = new UserMainProjection({} as EventStoreRepository, {} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new UserCreatedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new UserCreatedV1({ id: '1', password: '12345678', aggregateId: '1234', aggregateVersion: 1 }),
        expected: { id: '1', password: '12345678' }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
