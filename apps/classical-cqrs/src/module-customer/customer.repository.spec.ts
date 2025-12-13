import { jest } from '@jest/globals'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerRepository } from './customer.repository.js'
import { CustomerAggregate } from './customer.aggregate.js'
import { CreateCustomerCommand } from './commands/CreateCustomerCommand.js'

describe('CustomerRepository', () => {
  describe('buildCustomerAggregate', () => {
    let repository: CustomerRepository
    let eventStore: EventStoreRepository
    let snapshotRepository: AggregateSnapshotRepository

    beforeEach(() => {
      eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
      eventStore.getEventsByAggregateId = jest
        .fn()
        .mockImplementation(() => [
          {
            name: 'CustomerCreated',
            aggregateVersion: 2,
            version: 1,
            body: {
              id: '123',
              userID: '1',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john.doe@example.com',
              phoneNumber: '+1234567890'
            }
          }
        ]) as jest.Mocked<typeof eventStore.getEventsByAggregateId>
      snapshotRepository = new AggregateSnapshotRepository({} as knex.Knex, {} as Logger)
      snapshotRepository.getLatestSnapshotByAggregateId = jest.fn().mockImplementation(() => ({
        id: '123',
        aggregateVersion: 1,
        aggregateId: '123',
        state: {
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        }
      })) as jest.Mocked<typeof snapshotRepository.getLatestSnapshotByAggregateId>
      repository = new CustomerRepository(eventStore, snapshotRepository)
    })

    const testCases = [
      {
        description: 'should build an aggregate using events from Event Store',
        id: '1',
        expected:
          '{"id":"123","version":2,"userID":"1","firstName":"John","lastName":"Doe","email":"john.doe@example.com","phoneNumber":"+1234567890"}'
      },
      {
        description: 'should return an empty aggregate if no ID specified',
        id: '',
        expected: '{"version":0}'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repository.buildCustomerAggregate(id)
      console.log(JSON.stringify(result))
      console.log(result.id)
      expect(JSON.stringify(result)).toEqual(expected)
    })

    test('should return an aggregate from cache', async () => {
      await repository.buildCustomerAggregate('2')
      await repository.buildCustomerAggregate('2')

      expect(snapshotRepository.getLatestSnapshotByAggregateId).toHaveBeenCalledTimes(1)
    })
  })

  describe('save', () => {
    const eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
    eventStore.saveEvents = jest.fn() as jest.Mocked<typeof eventStore.saveEvents>
    const snapshotRepository = new AggregateSnapshotRepository({} as knex.Knex, {} as Logger)
    snapshotRepository.saveSnapshot = jest.fn() as jest.Mocked<typeof snapshotRepository.saveSnapshot>
    const repository = new CustomerRepository(eventStore, snapshotRepository)

    const testCases = [
      {
        description: 'should save events to the Event Sotre',
        getAggregate: () => {
          const aggregate = new CustomerAggregate()
          aggregate.create(
            new CreateCustomerCommand({
              userID: 'user1',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john.doe@example.com',
              phoneNumber: '+1234567890'
            })
          )
          return aggregate
        },
        expected: true
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        getAggregate: () => {
          return new CustomerAggregate()
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
