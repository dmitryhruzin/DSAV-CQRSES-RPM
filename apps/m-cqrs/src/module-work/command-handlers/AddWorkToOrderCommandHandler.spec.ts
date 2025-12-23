import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { AddWorkToOrderCommand } from '../commands/index.js'
import { OrderRepository } from '../../module-order/order.repository.js'
import { WorkAddedToOrderV1 } from '../events/index.js'
import { AddWorkToOrderCommandHandler } from './AddWorkToOrderCommandHandler.js'

describe('AddWorkToOrderCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkAddedToOrderV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousOrderID: 'Old Order',
        orderID: 'New Order'
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      addToOrder: (command: { id: string; previousOrderID: string; orderID: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: AddWorkToOrderCommandHandler

    beforeEach(() => {
      aggregate = {
        addToOrder: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.addToOrder>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new WorkRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildWorkAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildWorkAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      const orderRepository = new OrderRepository({} as EventStoreRepository, {} as knex.Knex)
      orderRepository.buildOrderAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof orderRepository.buildOrderAggregate
      >
      handler = new AddWorkToOrderCommandHandler(repository, orderRepository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new AddWorkToOrderCommand({ id: '1', orderID: 'New Order' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.addToOrder).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
