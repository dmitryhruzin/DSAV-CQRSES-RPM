import { jest } from '@jest/globals'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { UserRepository } from './user.repository.js'
import { UserAggregate } from './user.aggregate.js'
import { CreateUserCommand } from './commands/CreateUserCommand.js'

describe('UserRepository', () => {
  describe('buildUserAggregate', () => {
    let repository: UserRepository
    let eventStore: EventStoreRepository
    let snapshotRepository: AggregateSnapshotRepository

    beforeEach(() => {
      eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
      eventStore.getEventsByAggregateId = jest
        .fn()
        .mockImplementation(() => [
          { name: 'UserPasswordChanged', aggregateVersion: 2, version: 1, body: { password: 'oldPassword' } }
        ]) as jest.Mocked<typeof eventStore.getEventsByAggregateId>
      snapshotRepository = new AggregateSnapshotRepository({} as knex.Knex, {} as Logger)
      snapshotRepository.getLatestSnapshotByAggregateId = jest.fn().mockImplementation(() => ({
        id: '123',
        aggregateVersion: 1,
        aggregateId: '123',
        state: { password: 'newPassword' }
      })) as jest.Mocked<typeof snapshotRepository.getLatestSnapshotByAggregateId>
      repository = new UserRepository(eventStore, snapshotRepository)
    })

    const testCases = [
      {
        description: 'should build an aggregate using events from Event Store',
        id: '1',
        expected: '{"id":"123","version":2,"password":"oldPassword"}'
      },
      {
        description: 'should return an empty aggregate if no ID specified',
        id: '',
        expected: '{"version":0}'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repository.buildUserAggregate(id)
      expect(JSON.stringify(result)).toEqual(expected)
    })

    test('should return an aggregate from cache', async () => {
      await repository.buildUserAggregate('2')
      await repository.buildUserAggregate('2')

      expect(snapshotRepository.getLatestSnapshotByAggregateId).toHaveBeenCalledTimes(1)
    })
  })

  describe('save', () => {
    const eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
    eventStore.saveEvents = jest.fn() as jest.Mocked<typeof eventStore.saveEvents>
    const snapshotRepository = new AggregateSnapshotRepository({} as knex.Knex, {} as Logger)
    snapshotRepository.saveSnapshot = jest.fn() as jest.Mocked<typeof snapshotRepository.saveSnapshot>
    const repository = new UserRepository(eventStore, snapshotRepository)

    const testCases = [
      {
        description: 'should save events to the Event Sotre',
        getAggregate: () => {
          const aggregate = new UserAggregate()
          aggregate.create(new CreateUserCommand({ password: '12345678' }))
          return aggregate
        },
        expected: true
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        getAggregate: () => {
          return new UserAggregate()
        },
        expectedError: 'Aggregate is empty'
      }
    ]
    test.each(testCases)('$description', async ({ getAggregate, expected, expectedError }) => {
      try {
        const result = await repository.save(getAggregate(), [])
        expect(result).toEqual(expected)

        if (expectedError) {
          expect(true).toBeFalsy()
        }
      } catch (err) {
        if (!expectedError) {
          throw err
        }
        expect((err as Error).message).toEqual(expectedError)
      }
    })
  })
})
