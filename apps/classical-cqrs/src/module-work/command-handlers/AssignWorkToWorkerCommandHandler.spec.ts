import { jest } from '@jest/globals'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { AssignWorkToWorkerCommand } from '../commands/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'
import { WorkAssignedToWorkerV1 } from '../events/WorkAssignedToWorkerV1.js'
import { AssignWorkToWorkerCommandHandler } from './AssignWorkToWorkerCommandHandler.js'
import { WorkerRepository } from '../../module-worker/worker.repository.js'

describe('AssignWorkToWorkerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkAssignedToWorkerV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousWorkerID: 'Old Worker',
        workerID: 'New Worker'
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      assignToWorker: (command: { id: string; previousWorkerID: string; workerID: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: AssignWorkToWorkerCommandHandler

    beforeEach(() => {
      aggregate = {
        assignToWorker: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.assignToWorker>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new WorkRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.buildWorkAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildWorkAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      const workerRepository = new WorkerRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      workerRepository.buildWorkerAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof workerRepository.buildWorkerAggregate
      >
      handler = new AssignWorkToWorkerCommandHandler(repository, workerRepository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new AssignWorkToWorkerCommand({ id: '1', workerID: 'New Worker' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.assignToWorker).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
