import { jest } from '@jest/globals'
import knex from 'knex'
import { SetOrderPriorityCommandHandler } from './SetOrderPriorityCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { OrderRepository } from '../order.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { SetOrderPriorityCommand } from '../commands/index.js'
import { OrderPrioritySetV1 } from '../events/index.js'

describe('SetOrderPriorityCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new OrderPrioritySetV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousPriority: 1,
        priority: 2
      })
    ]

    let repository: OrderRepository
    let aggregate: {
      setPriority: (command: { id: string; previousPriority: number; priority: number }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: SetOrderPriorityCommandHandler

    beforeEach(() => {
      aggregate = {
        setPriority: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.setPriority>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new OrderRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildOrderAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildOrderAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new SetOrderPriorityCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new SetOrderPriorityCommand({ id: '1', priority: 2 }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.setPriority).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
