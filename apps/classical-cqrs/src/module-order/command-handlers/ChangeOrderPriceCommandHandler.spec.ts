import { jest } from '@jest/globals'
import { ChangeOrderPriceCommandHandler } from './ChangeOrderPriceCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { OrderRepository } from '../order.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeOrderPriceCommand } from '../commands/index.js'
import { OrderPriceChangedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('ChangeOrderPriceCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new OrderPriceChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousPrice: '10.00',
        price: '15.00'
      })
    ]

    let repository: OrderRepository
    let aggregate: {
      changePrice: (command: { id: string; previousPrice: string; price: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeOrderPriceCommandHandler

    beforeEach(() => {
      aggregate = {
        changePrice: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changePrice>,
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
      handler = new ChangeOrderPriceCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeOrderPriceCommand({ id: '1', price: '15.00' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changePrice).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
