import { jest } from '@jest/globals'
import { ApplyDiscountToOrderCommandHandler } from './ApplyDiscountToOrderCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { OrderRepository } from '../order.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ApplyDiscountToOrderCommand } from '../commands/index.js'
import { OrderDiscountAppliedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('ApplyDiscountToOrderCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new OrderDiscountAppliedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousDiscount: '10.00',
        discount: '15.00'
      })
    ]

    let repository: OrderRepository
    let aggregate: {
      applyDiscount: (command: { id: string; previousDiscount: string; discount: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ApplyDiscountToOrderCommandHandler

    beforeEach(() => {
      aggregate = {
        applyDiscount: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.applyDiscount>,
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
      handler = new ApplyDiscountToOrderCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ApplyDiscountToOrderCommand({ id: '1', discount: '15.00' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.applyDiscount).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
