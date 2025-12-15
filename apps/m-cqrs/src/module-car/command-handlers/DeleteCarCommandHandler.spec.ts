import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { CarRepository } from '../car.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { DeleteCarCommand } from '../commands/index.js'
import { CarDeletedV1 } from '../events/index.js'
import { DeleteCarCommandHandler } from './DeleteCarCommandHandler.js'

describe('DeleteCarCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CarDeletedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        deletedAt: new Date()
      })
    ]

    let repository: CarRepository
    let aggregate: {
      delete: (command: { id: string; firstName: string; lastName: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: DeleteCarCommandHandler

    beforeEach(() => {
      aggregate = {
        delete: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.delete>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new CarRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildCarAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildCarAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new DeleteCarCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new DeleteCarCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.delete).toHaveBeenCalledWith()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
