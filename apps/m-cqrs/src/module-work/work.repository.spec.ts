import { jest } from '@jest/globals'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkRepository } from './work.repository.js'
import { WorkAggregate } from './work.aggregate.js'
import { CreateWorkCommand } from './commands/index.js'
import { STATUS } from '../constants/order.js'

describe('WorkRepository', () => {
  describe('buildWorkAggregate', () => {
    let repository: WorkRepository
    let db: knex.Knex = {} as knex.Knex

    beforeEach(() => {
      db.table = jest.fn().mockImplementation(() => ({
        where: () => ({
          first: () => ({
            id: '123',
            version: 2,
            title: 'New Title',
            description: 'Test Description',
            status: STATUS.TODO
          })
        })
      })) as jest.Mocked<typeof db.table>
      repository = new WorkRepository({} as EventStoreRepository, db)
    })

    const testCases = [
      {
        description: 'should build an aggregate using events from Event Store',
        id: '1',
        expected: '{"id":"123","version":2,"title":"New Title","description":"Test Description","status":"todo"}'
      },
      {
        description: 'should return an empty aggregate if no ID specified',
        id: '',
        expected: '{"version":0}'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repository.buildWorkAggregate(id)
      expect(JSON.stringify(result)).toEqual(expected)
    })

    test('should return an aggregate from cache', async () => {
      await repository.buildWorkAggregate('2')
      await repository.buildWorkAggregate('2')

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
    const repository = new WorkRepository(eventStore, db)

    const testCases = [
      {
        description: 'should save events to the Event Sotre',
        getAggregate: () => {
          const aggregate = new WorkAggregate()
          aggregate.create(
            new CreateWorkCommand({
              title: 'Test Work',
              description: 'Test Description'
            })
          )
          return aggregate
        },
        expected: true
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        getAggregate: () => {
          return new WorkAggregate()
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
