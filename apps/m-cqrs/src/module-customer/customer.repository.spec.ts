import { jest } from '@jest/globals'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerRepository } from './customer.repository.js'
import { CustomerAggregate } from './customer.aggregate.js'
import { CreateCustomerCommand } from './commands/CreateCustomerCommand.js'

describe('CustomerRepository', () => {
  describe('buildCustomerAggregate', () => {
    let repository: CustomerRepository
    let db: knex.Knex = {} as knex.Knex

    beforeEach(() => {
      db.table = jest.fn().mockImplementation(() => ({
        where: () => ({ first: () => ({ id: '1', version: 2, first_name: 'John', last_name: 'Doe', user_id: 'user1', email: 'john.doe@example.com', phone_number: '1234567890', deleted_at: null }) })
      })) as jest.Mocked<typeof db.table>
      repository = new CustomerRepository({} as EventStoreRepository, db)
    })

    const testCases = [
      {
        description: 'should build an aggregate using the latest snapshot',
        id: '1',
        expected: '{"id":"1","version":2,"userID":"user1","firstName":"John","lastName":"Doe","email":"john.doe@example.com","phoneNumber":"1234567890","deletedAt":null}'
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        id: '',
        expected: '{"version":0}'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repository.buildCustomerAggregate(id)
      expect(JSON.stringify(result)).toEqual(expected)
    })

    test('should return an aggregate from cache', async () => {
      await repository.buildCustomerAggregate('2')
      await repository.buildCustomerAggregate('2')

      expect(db.table).toHaveBeenCalledTimes(1)
    })
  })

  describe('save', () => {
    const eventStore = new EventStoreRepository({} as knex.Knex, {} as Logger)
    eventStore.saveEvents = jest.fn() as jest.Mocked<typeof eventStore.saveEvents>
    const db: knex.Knex = {} as knex.Knex
    db.table = jest
      .fn()
      .mockImplementation(() => ({ insert: () => ({ onConflict: () => ({ merge: () => {} }) }) })) as jest.Mocked<
      typeof db.table
    >
    db.transaction = jest.fn().mockImplementation(() => {
      const trx = jest
        .fn()
        .mockImplementation(() => ({ insert: () => ({ onConflict: () => ({ merge: () => {} }) }) })) as jest.Mock & {
        commit: jest.Mock
        rollback: jest.Mock
      }
      trx.commit = jest.fn()
      trx.rollback = jest.fn()

      return trx
    }) as jest.MockedFunction<typeof db.transaction>
    const repository = new CustomerRepository(eventStore, db)

    const testCases = [
      {
        description: 'should save events to the Event Sotre',
        getAggregate: () => {
          const aggregate = new CustomerAggregate()
          aggregate.create(new CreateCustomerCommand({ userID: 'user1', firstName: 'John', lastName: 'Doe' }))
          return aggregate
        },
        expected: true
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        getAggregate: () => {
          return new CustomerAggregate()
        },
        expectedError: 'Aggregate is empty'
      }
    ]
    test.each(testCases)('$description', async ({ getAggregate, expected, expectedError }) => {
      try {
        const result = await repository.save(getAggregate(), [])
        expect(result).toEqual(expected)

        if (expectedError) {
          expect(true).toBeFalsy()
        }
      } catch (err) {
        if (!expectedError) {
          throw err
        }
        expect((err as Error).message).toEqual(expectedError)
      }
    })
  })
})
