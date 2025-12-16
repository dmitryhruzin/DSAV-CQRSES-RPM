import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { WorkerRepository } from '../worker.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeWorkerHourlyRateCommand } from '../commands/index.js'
import { ChangeWorkerHourlyRateCommandHandler } from './ChangeWorkerHourlyRateCommandHandler.js'
import { WorkerHourlyRateChangedV1 } from '../events/index.js'

describe('ChangeWorkerHourlyRateCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new WorkerHourlyRateChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousHourlyRate: '50',
        hourlyRate: '60'
      })
    ]

    let repository: WorkerRepository
    let aggregate: {
      changeHourlyRate: (command: { id: string; hourlyRate: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeWorkerHourlyRateCommandHandler

    beforeEach(() => {
      aggregate = {
        changeHourlyRate: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changeHourlyRate>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new WorkerRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildWorkerAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildWorkerAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new ChangeWorkerHourlyRateCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeWorkerHourlyRateCommand({
          id: '1',
          hourlyRate: '60.00'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changeHourlyRate).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
