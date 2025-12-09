import { jest } from '@jest/globals'
import { ChangeUserPasswordCommandHandler } from './ChangeUserPasswordCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { UserRepository } from '../user.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeUserPasswordCommand } from '../commands/index.js'
import { UserPasswordChangedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('ChangeUserPasswordCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new UserPasswordChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousPassword: 'oldPassword',
        password: 'newPassword'
      })
    ]

    let repository: UserRepository
    let aggregate: {
      changePassword: (command: { id: string; newPassword: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeUserPasswordCommandHandler

    beforeEach(() => {
      aggregate = {
        changePassword: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changePassword>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
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
      handler = new ChangeUserPasswordCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeUserPasswordCommand({ id: '1', newPassword: '12345678' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changePassword).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
