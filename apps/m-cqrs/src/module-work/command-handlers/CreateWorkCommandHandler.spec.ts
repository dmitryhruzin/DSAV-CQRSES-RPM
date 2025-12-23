import { jest } from '@jest/globals'
import knex from 'knex'
import { CreateWorkCommandHandler } from './CreateWorkCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { CreateWorkCommand } from '../commands/index.js'
import { WorkCreatedV1 } from '../events/index.js'
import { STATUS } from '../../constants/work.js'

describe('CreateWorkCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkCreatedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        id: '1',
        title: 'Test Work',
        description: 'This is a test work',
        status: STATUS.TODO
      })
    ]

    let repository: WorkRepository
    let aggregate: { create: (work: {}) => Event[]; commit: () => {} }
    let publisher: EventPublisher
    let handler: CreateWorkCommandHandler

    beforeEach(() => {
      repository = new WorkRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      aggregate = {
        create: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.create>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>
      }
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new CreateWorkCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new CreateWorkCommand({
          title: 'Test Work',
          description: 'This is a test work'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.create).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
