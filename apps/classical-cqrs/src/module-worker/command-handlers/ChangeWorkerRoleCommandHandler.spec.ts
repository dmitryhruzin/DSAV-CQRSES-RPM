import { jest } from '@jest/globals'
import { ChangeWorkerRoleCommandHandler } from './ChangeWorkerRoleCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkerRepository } from '../worker.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeWorkerRoleCommand } from '../commands/index.js'
import { WorkerRoleChangedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('ChangeWorkerRoleCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkerRoleChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousRole: 'manager',
        role: 'washer'
      })
    ]

    let repository: WorkerRepository
    let aggregate: {
      changeRole: (command: { id: string; previousRole: string; role: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeWorkerRoleCommandHandler

    beforeEach(() => {
      aggregate = {
        changeRole: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changeRole>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new WorkerRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.buildWorkerAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildWorkerAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new ChangeWorkerRoleCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeWorkerRoleCommand({ id: '1', role: 'washer' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changeRole).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
