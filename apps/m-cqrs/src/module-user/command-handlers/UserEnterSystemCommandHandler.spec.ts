import { jest } from '@jest/globals'
import knex from 'knex'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { EventPublisher } from '@nestjs/cqrs'
import { UserEnterSystemCommandHandler } from './UserEnterSystemCommandHandler.js'
import { UserRepository } from '../user.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { UserEnterSystemCommand } from '../commands/index.js'
import { UserEnteredSystemV1 } from '../events/index.js'

describe('UserEnterSystemCommandHandler', () => {
  describe('execute', () => {
    const events = [new UserEnteredSystemV1({ aggregateId: '123', aggregateVersion: 1 })]

    let repository: UserRepository
    let aggregate: { enterSystem: () => Event[]; commit: () => {}; version: number }
    let publisher: EventPublisher
    let handler: UserEnterSystemCommandHandler

    beforeEach(() => {
      repository = new UserRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      repository.buildUserAggregate = jest.fn() as jest.Mocked<typeof repository.buildUserAggregate>
      aggregate = {
        enterSystem: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.enterSystem>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
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
