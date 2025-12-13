import { jest } from '@jest/globals'
import knex from 'knex'
import { EventPublisher } from '@nestjs/cqrs'
import { CustomerRepository } from '../customer.repository.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { EventBus } from '@nestjs/cqrs/dist/event-bus.js'
import { DeleteCustomerCommand } from '../commands/index.js'
import { CustomerRenamedV1 } from '../events/index.js'
import { DeleteCustomerCommandHandler } from './DeleteCustomerCommandHandler.js'

describe('DeleteCustomerCommandHandler', () => {
  describe('execute', () => {
    const events = [
      new CustomerRenamedV1({
        aggregateId: '123',
        aggregateVersion: 1,
        previousFirstName: 'OldFirstName',
        previousLastName: 'OldLastName',
        firstName: 'NewFirstName',
        lastName: 'NewLastName'
      })
    ]

    let repository: CustomerRepository
    let aggregate: {
      delete: (command: { id: string; firstName: string; lastName: string }) => Event[]
      commit: () => {}
      version: number
    }
    let publisher: EventPublisher
    let handler: DeleteCustomerCommandHandler

    beforeEach(() => {
      aggregate = {
        delete: jest.fn().mockImplementation(() => events) as jest.Mocked<typeof aggregate.delete>,
        commit: jest.fn() as jest.Mocked<typeof aggregate.commit>,
        version: 1
      }
      repository = new CustomerRepository({} as EventStoreRepository, {} as knex.Knex)
      repository.buildCustomerAggregate = jest.fn().mockImplementation(() => aggregate) as jest.Mocked<
        typeof repository.buildCustomerAggregate
      >
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      publisher = new EventPublisher({} as EventBus)
      publisher.mergeObjectContext = jest.fn().mockImplementation(() => {
        return aggregate
      }) as jest.Mocked<typeof publisher.mergeObjectContext>
      handler = new DeleteCustomerCommandHandler(repository, publisher)
    })

    const testCases = [
      {
        description: 'should update aggregate, save and commit events',
        payload: new DeleteCustomerCommand({ id: '1' }),
        expected: events
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.execute(payload)

      expect(repository.save).toHaveBeenCalledWith(aggregate, expected)
      expect(aggregate.delete).toHaveBeenCalledWith()
      expect(aggregate.commit).toHaveBeenCalledTimes(1)
    })
  })
})
