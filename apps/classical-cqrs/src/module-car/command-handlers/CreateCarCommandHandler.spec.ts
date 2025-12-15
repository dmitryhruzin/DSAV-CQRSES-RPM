import { jest } from '@jest/globals'
import knex from 'knex'
import { CreateCarCommandHandler } from './CreateCarCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { CarRepository } from '../car.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { CreateCarCommand } from '../commands/index.js'
import { CarCreatedV1 } from '../events/index.js'
import { CustomerRepository } from '../../module-customer/customer.repository.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'

describe('CreateCarCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CarCreatedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        id: '1',
        vin: '1HGCM82633A123456',
        registrationNumber: 'ABC123',
        mileage: 10000,
        ownerID: '1'
      })
    ]

    let repository: CarRepository
    let aggregate: { create: (car: {}) => Event[]; commit: () => {} }
    let publisher: EventPublisher
    let handler: CreateCarCommandHandler

    beforeEach(() => {
      repository = new CarRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      aggregate = {
        create: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.create>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>
      }
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      const customerRepository = new CustomerRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      customerRepository.buildCustomerAggregate = jest.fn().mockImplementation(() => ({ version: 1 })) as jest.Mocked<
        typeof customerRepository.buildCustomerAggregate
      >
      handler = new CreateCarCommandHandler(repository, customerRepository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new CreateCarCommand({
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB123AA',
          mileage: 10000
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
