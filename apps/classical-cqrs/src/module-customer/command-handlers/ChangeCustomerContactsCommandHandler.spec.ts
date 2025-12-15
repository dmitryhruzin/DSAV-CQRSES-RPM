import { jest } from '@jest/globals'
import { EventPublisher } from '@nestjs/cqrs'
import { CustomerRepository } from '../customer.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { ChangeCustomerContactsCommand } from '../commands/index.js'
import { CustomerContactsChangedV1 } from '../events/index.js'
import { AggregateSnapshotRepository } from '../../infra/aggregate-snapshot.repository.js'
import { ChangeCustomerContactsCommandHandler } from './index.js'

describe('ChangeCustomerContactsCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CustomerContactsChangedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        email: 'newemail@example.com',
        phoneNumber: '1234567890',
        previousEmail: 'oldemail@example.com',
        previousPhoneNumber: '0987654321'
      })
    ]

    let repository: CustomerRepository
    let aggregate: {
      changeContacts: (command: { id: string; email: string; phoneNumber: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: ChangeCustomerContactsCommandHandler

    beforeEach(() => {
      aggregate = {
        changeContacts: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.changeContacts>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new CustomerRepository({} as EventStoreRepository, {} as AggregateSnapshotRepository)
      repository.buildCustomerAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildCustomerAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new ChangeCustomerContactsCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new ChangeCustomerContactsCommand({
          id: '1',
          email: 'newemail@example.com',
          phoneNumber: '1234567890'
        }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.changeContacts).toHaveBeenCalledWith(payload)
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
