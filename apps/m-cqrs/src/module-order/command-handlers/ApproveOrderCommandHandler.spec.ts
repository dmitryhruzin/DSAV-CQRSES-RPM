import { jest } from '@jest/globals'
import knex from 'knex'
import { ApproveOrderCommandHandler } from './ApproveOrderCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { OrderRepository } from '../order.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ApproveOrderCommand } from '../commands/index.js'
import { OrderApprovedV1 } from '../events/index.js'

describe('ApproveOrderCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new OrderApprovedV1({
        aggregateId: '123',
        aggregateVersion: 1
      })
    ]

    let repository: OrderRepository
    let aggregate: {
      approve: (command: { id: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ApproveOrderCommandHandler

    beforeEach(() => {
      aggregate = {
        approve: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.approve>,
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
      handler = new ApproveOrderCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ApproveOrderCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.approve).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
