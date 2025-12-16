import { jest } from '@jest/globals'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerRepository } from './worker.repository.js'
import { WorkerAggregate } from './worker.aggregate.js'
import { HireWorkerCommand } from './commands/index.js'

describe('WorkerRepository', () => {
  describe('buildWorkerAggregate', () => {
    let repository: WorkerRepository
    let db: knex.Knex = {} as knex.Knex

    beforeEach(() => {
      db.table = jest.fn().mockImplementation(() => ({
        where: () => ({
          first: () => ({
            id: '1',
            version: 2,
            hourly_rate: '10.00',
            role: 'manager',
            deleted_at: null
          })
        })
      })) as jest.Mocked<typeof db.table>
      repository = new WorkerRepository({} as EventStoreRepository, db)
    })

    const testCases = [
      {
        description: 'should build an aggregate using the latest snapshot',
        id: '1',
        expected: '{"id":"1","version":2,"hourlyRate":"10.00","role":"manager","deletedAt":null}'
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        id: '',
        expected: '{"version":0}'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repository.buildWorkerAggregate(id)
      expect(JSON.stringify(result)).toEqual(expected)
    })

    test('should return an aggregate from cache', async () => {
      await repository.buildWorkerAggregate('2')
      await repository.buildWorkerAggregate('2')

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
    const repository = new WorkerRepository(eventStore, db)

    const testCases = [
      {
        description: 'should save events to the Event Sotre',
        getAggregate: () => {
          const aggregate = new WorkerAggregate()
          aggregate.hire(
            new HireWorkerCommand({
              hourlyRate: '10.00',
              role: 'manager'
            })
          )
          return aggregate
        },
        expected: true
      },
      {
        description: 'should return an empty aggregate is thee is no ID specified',
        getAggregate: () => {
          return new WorkerAggregate()
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
