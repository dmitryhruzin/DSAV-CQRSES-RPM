import { jest } from '@jest/globals'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { UnassignWorkFromWorkerCommand } from '../commands/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'
import { UnassignWorkFromWorkerCommandHandler } from './UnassignWorkFromWorkerCommandHandler.js'
import { WorkUnassignedFromWorkerV1 } from '../events/WorkUnassignedFromWorkerV1.js'

describe('UnassignWorkFromWorkerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkUnassignedFromWorkerV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousWorkerID: 'Old Worker'
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      unassignFromWorker: () => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: UnassignWorkFromWorkerCommandHandler

    beforeEach(() => {
      aggregate = {
        unassignFromWorker: jest.fn().mockImplementation(() => events) as jest.Mocked<
          typeof aggregate.unassignFromWorker
        >,
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
      handler = new UnassignWorkFromWorkerCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new UnassignWorkFromWorkerCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.unassignFromWorker).toHaveBeenCalled()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
