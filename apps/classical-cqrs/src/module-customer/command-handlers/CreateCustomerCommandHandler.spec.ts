import { jest } from '@jest/globals'
import { CreateCustomerCommandHandler } from './CreateCustomerCommandHandler.js'
import { EventPublisher } from '@nestjs/cqrs'
import { CustomerRepository } from '../customer.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { CreateCustomerCommand } from '../commands/index.js'
import { CustomerCreatedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'
import { UserRepository } from '../../module-user/user.repository.js'
import { UserAggregate } from '../../module-user/user.aggregate.js'

describe('CreateCustomerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CustomerCreatedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        id: '1',
        userID: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '123-456-7890'
      })
    ]

    let repository: CustomerRepository
    let aggregate: { create: (customer: {}) => Event[]; commit: () => {} }
    let publisher: EventPublisher
    let handler: CreateCustomerCommandHandler

    beforeEach(() => {
      repository = new CustomerRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      aggregate = {
        create: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.create>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>
      }
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      const userRepository = new UserRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      userRepository.buildUserAggregate = jest.fn().mockImplementation(() => ({ version: 1 })) as jest.Mocked<
        typeof userRepository.buildUserAggregate
      >
      handler = new CreateCustomerCommandHandler(repository, userRepository,publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new CreateCustomerCommand({
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '123-456-7890'
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
