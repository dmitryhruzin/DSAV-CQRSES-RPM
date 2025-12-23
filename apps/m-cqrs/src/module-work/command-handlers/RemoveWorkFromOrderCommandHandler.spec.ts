import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { RemoveWorkFromOrderCommand } from '../commands/index.js'
import { WorkRemovedFromOrderV1 } from '../events/index.js'
import { RemoveWorkFromOrderCommandHandler } from './RemoveWorkFromOrderCommandHandler.js'

describe('RemoveWorkFromOrderCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkRemovedFromOrderV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousOrderID: 'Old Order'
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      removeFromOrder: () => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: RemoveWorkFromOrderCommandHandler

    beforeEach(() => {
      aggregate = {
        removeFromOrder: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.removeFromOrder>,
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
      handler = new RemoveWorkFromOrderCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new RemoveWorkFromOrderCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.removeFromOrder).toHaveBeenCalled()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
