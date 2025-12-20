import { jest } from '@jest/globals'
import { CreateOrderCommandHandler } from './CreateOrderCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { OrderRepository } from '../order.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { CreateOrderCommand } from '../commands/index.js'
import { OrderCreatedV1 } from '../events/index.js'
import { STATUS } from '../../constants/order.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('CreateOrderCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new OrderCreatedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        id: '1',
        price: '100.00',
        title: 'Test Order',
        discount: '10.00',
        priority: 1,
        status: STATUS.TODO,
        approved: false
      })
    ]

    let repository: OrderRepository
    let aggregate: { create: (order: {}) => Event[]; commit: () => {} }
    let publisher: EventPublisher
    let handler: CreateOrderCommandHandler

    beforeEach(() => {
      repository = new OrderRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      aggregate = {
        create: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.create>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>
      }
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new CreateOrderCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new CreateOrderCommand({
          price: '100.00',
          title: 'Test Order',
          discount: '10.00',
          priority: 1
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.create).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
