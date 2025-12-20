import { jest } from '@jest/globals'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { OrderRepository } from './order.repository.js'
import { OrderAggregate } from './order.aggregate.js'
import { CreateOrderCommand } from './commands/index.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import { STATUS } from '../../src/constants/order.js'

describe('OrderRepository', () => {
  describe('buildOrderAggregate', () => {
    let repository: OrderRepository
    let eventStore: EventStoreRepository
    let snapshotRepository: AggregateSnapshotRepository

    beforeEach(() => {
      eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
      eventStore.getEventsByAggregateId = jest.fn().mockImplementation(() => [
        {
          name: 'OrderPriceChanged',
          aggregateVersion: 2,
          version: 1,
          body: {
            id: '123',
            previousPrice: '100.00',
            price: '120.00'
          }
        }
      ]) as jest.Mocked<typeof eventStore.getEventsByAggregateId>
      snapshotRepository = new AggregateSnapshotRepository({} as knex.Knex, {} as Logger)
      snapshotRepository.getLatestSnapshotByAggregateId = jest.fn().mockImplementation(() => ({
        id: '123',
        aggregateVersion: 1,
        aggregateId: '123',
        state: {
          title: 'Test Order',
          price: '20.00',
          status: STATUS.TODO
        }
      })) as jest.Mocked<typeof snapshotRepository.getLatestSnapshotByAggregateId>
      repository = new OrderRepository(eventStore, snapshotRepository)
    })

    const testCases = [
      {
        description: 'should build an aggregate using events from Event Store',
        id: '1',
        expected: '{"id":"123","version":2,"title":"Test Order","price":"120.00","status":"todo"}'
      },
      {
        description: 'should return an empty aggregate if no ID specified',
        id: '',
        expected: '{"version":0}'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repository.buildOrderAggregate(id)
      expect(JSON.stringify(result)).toEqual(expected)
    })

    test('should return an aggregate from cache', async () => {
      await repository.buildOrderAggregate('2')
      await repository.buildOrderAggregate('2')

      expect(snapshotRepository.getLatestSnapshotByAggregateId).toHaveBeenCalledTimes(1)
    })
  })

  describe('save', () => {
    const eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
    eventStore.saveEvents = jest.fn() as jest.Mocked<typeof eventStore.saveEvents>
    const snapshotRepository = new AggregateSnapshotRepository({} as knex.Knex, {} as Logger)
    snapshotRepository.saveSnapshot = jest.fn() as jest.Mocked<typeof snapshotRepository.saveSnapshot>
    const repository = new OrderRepository(eventStore, snapshotRepository)

    const testCases = [
      {
        description: 'should save events to the Event Sotre',
        getAggregate: () => {
          const aggregate = new OrderAggregate()
          aggregate.create(
            new CreateOrderCommand({
              title: 'Test Order',
              price: '20.00'              
            })
          )
          return aggregate
        },
        expected: true
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        getAggregate: () => {
          return new OrderAggregate()
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
