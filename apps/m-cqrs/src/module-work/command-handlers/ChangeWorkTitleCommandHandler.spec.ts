import { jest } from '@jest/globals'
import knex from 'knex'
import { ChangeWorkTitleCommandHandler } from './ChangeWorkTitleCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkRepository } from '../work.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeWorkTitleCommand } from '../commands/index.js'
import { WorkTitleChangedV1 } from '../events/index.js'

describe('ChangeWorkTitleCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkTitleChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousTitle: 'Old Title',
        title: 'New Title'
      })
    ]

    let repository: WorkRepository
    let aggregate: {
      changeTitle: (command: { id: string; previousTitle: string; title: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeWorkTitleCommandHandler

    beforeEach(() => {
      aggregate = {
        changeTitle: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changeTitle>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new WorkRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildWorkAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildWorkAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new ChangeWorkTitleCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeWorkTitleCommand({ id: '1', title: 'New Title' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changeTitle).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
