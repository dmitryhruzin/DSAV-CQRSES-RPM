import { jest } from '@jest/globals'
import { EventPublisher } from '@nestjs/cqrs'
import { OrderRepository } from '../order.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { CancelOrderCommand } from '../commands/index.js'
import { CancelOrderCommandHandler } from './CancelOrderCommandHandler.js'
import { OrderStatusChangedV1 } from '../events/index.js'
import { STATUS } from '../../constants/order.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('CancelOrderCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new OrderStatusChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousStatus: STATUS.TODO,
        status: STATUS.IN_PROGRESS
      })
    ]

    let repository: OrderRepository
    let aggregate: {
      cancel: (command: { id: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: CancelOrderCommandHandler

    beforeEach(() => {
      aggregate = {
        cancel: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.cancel>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new OrderRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.buildOrderAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildOrderAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new CancelOrderCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new CancelOrderCommand({
          id: '1'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.cancel).toHaveBeenCalled()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
