import { jest } from '@jest/globals'
import { UserEnterSystemCommandHandler } from './UserEnterSystemCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { UserRepository } from '../user.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { UserEnterSystemCommand } from '../commands/index.js'
import { UserEnteredSystemV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('UserEnterSystemCommandHandler', () => {
  describe('execute', () => {
    const events = [new UserEnteredSystemV1({ aggregateId: '123', aggregateVersion: 1 })]

    let repository: UserRepository
    let aggregate: { enterSystem: () => Event[]; commit: () => {} }
    let publisher: EventPublisher
    let handler: UserEnterSystemCommandHandler

    beforeEach(() => {
      aggregate = {
        enterSystem: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.enterSystem>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>
      }
      repository = new UserRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.buildUserAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildUserAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new UserEnterSystemCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new UserEnterSystemCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.enterSystem).toHaveBeenCalledWith()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
