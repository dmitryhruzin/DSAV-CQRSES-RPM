import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { CarRepository } from '../car.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { RecordCarMileageCommand } from '../commands/index.js'
import { CarMileageRecordedV1 } from '../events/index.js'
import { RecordCarMileageCommandHandler } from './index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('RecordCarMileageCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CarMileageRecordedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousMileage: 10000,
        mileage: 15000
      })
    ]

    let repository: CarRepository
    let aggregate: {
      recordMileage: (command: { id: string; mileage: number }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: RecordCarMileageCommandHandler

    beforeEach(() => {
      aggregate = {
        recordMileage: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.recordMileage>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new CarRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.buildCarAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildCarAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new RecordCarMileageCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new RecordCarMileageCommand({
          id: '1',
          mileage: 15000
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.recordMileage).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
