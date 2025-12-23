import { jest } from '@jest/globals'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { StartWorkCommand } from '../commands/index.js'
import { WorkStatusChangedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'
import { STATUS } from '../../constants/work.js'
import { CancelWorkCommandHandler } from './CancelWorkCommandHandler.js'

describe('CancelWorkCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkStatusChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousStatus: STATUS.TODO,
        status: STATUS.IN_PROGRESS
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      cancel: (command: { id: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: CancelWorkCommandHandler

    beforeEach(() => {
      aggregate = {
        cancel: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.cancel>,
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
      handler = new CancelWorkCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new StartWorkCommand({
          id: '1'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.cancel).toHaveBeenCalled()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
