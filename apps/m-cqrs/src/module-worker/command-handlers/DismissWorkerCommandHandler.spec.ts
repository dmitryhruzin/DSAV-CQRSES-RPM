import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkerRepository } from '../worker.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { DismissWorkerCommand } from '../commands/index.js'
import { WorkerDismissedV1 } from '../events/index.js'
import { DismissWorkerCommandHandler } from './DismissWorkerCommandHandler.js'

describe('DismissWorkerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkerDismissedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        deletedAt: new Date()
      })
    ]

    let repository: WorkerRepository
    let aggregate: {
      dismiss: (command: { id: string; firstName: string; lastName: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: DismissWorkerCommandHandler

    beforeEach(() => {
      aggregate = {
        dismiss: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.dismiss>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new WorkerRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildWorkerAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildWorkerAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new DismissWorkerCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new DismissWorkerCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.dismiss).toHaveBeenCalledWith()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
