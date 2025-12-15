import { jest } from '@jest/globals'
import knex from 'knex'
import { ChangeCarOwnerCommandHandler } from './ChangeCarOwnerCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { CarRepository } from '../car.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeCarOwnerCommand } from '../commands/index.js'
import { CarOwnerChangedV1 } from '../events/index.js'
import { CustomerRepository } from '../../module-customer/customer.repository.js'

describe('ChangeCarOwnerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CarOwnerChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousOwnerID: '1',
        ownerID: '2'
      })
    ]

    let repository: CarRepository
    let aggregate: {
      changeOwner: (command: { id: string; previousOwnerID: string; ownerID: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeCarOwnerCommandHandler

    beforeEach(() => {
      aggregate = {
        changeOwner: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changeOwner>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new CarRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildCarAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildCarAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      const customerRepository = new CustomerRepository({} as EventStoreRepository, {} as knex.Knex)
      customerRepository.buildCustomerAggregate = jest.fn().mockImplementation(() => ({ version: 1 })) as jest.Mocked<
        typeof customerRepository.buildCustomerAggregate
      >
      handler = new ChangeCarOwnerCommandHandler(repository, customerRepository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeCarOwnerCommand({ id: '1', ownerID: '2' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changeOwner).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
