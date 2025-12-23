import { jest } from '@jest/globals'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeWorkDescriptionCommand } from '../commands/index.js'
import { ChangeWorkDescriptionCommandHandler } from './ChangeWorkDescriptionCommandHandler.js'
import { WorkDescriptionChangedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('ChangeWorkDescriptionCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkDescriptionChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousDescription: 'Old description',
        description: 'New description'
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      changeDescription: (command: { id: string; description: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeWorkDescriptionCommandHandler

    beforeEach(() => {
      aggregate = {
        changeDescription: jest.fn().mockImplementation(() => events) as jest.Mocked<
          typeof aggregate.changeDescription
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
      handler = new ChangeWorkDescriptionCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeWorkDescriptionCommand({
          id: '1',
          description: 'New description'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changeDescription).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
