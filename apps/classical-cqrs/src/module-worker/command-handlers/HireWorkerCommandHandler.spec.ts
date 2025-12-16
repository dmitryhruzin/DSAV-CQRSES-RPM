import { jest } from '@jest/globals'
import { HireWorkerCommandHandler } from './HireWorkerCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkerRepository } from '../worker.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { HireWorkerCommand } from '../commands/index.js'
import { WorkerHiredV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('HireWorkerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkerHiredV1({
        aggregateId: '123',
        aggregateVersion: 1,
        id: '1',
        hourlyRate: '15.00',
        role: 'manager'
      })
    ]

    let repository: WorkerRepository
    let aggregate: { hire: (worker: {}) => Event[]; commit: () => {} }
    let publisher: EventPublisher
    let handler: HireWorkerCommandHandler

    beforeEach(() => {
      repository = new WorkerRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      aggregate = {
        hire: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.hire>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>
      }
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new HireWorkerCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new HireWorkerCommand({
          hourlyRate: '15.00',
          role: 'manager'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.hire).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
