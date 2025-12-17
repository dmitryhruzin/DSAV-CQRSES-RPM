import knex from 'knex'
import { testConfig } from '../../knexfile.js'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from './event-store.repository.js'
import { Event } from '../types/common.js'

describe('EventStoreRepository', () => {
  const logger = new Logger({})
  let db: knex.Knex

  beforeAll(() => {
    db = knex(testConfig)
  })

  afterAll(async () => {
    await db.schema.dropTable('events')
    await db.destroy()
  })

  describe('getEventsByAggregateId', () => {
    const EVENTS_MOCK = [
      { aggregate_id: '1', aggregate_version: 1, name: 'UserCreatedV1', body: { name: 'John Doe' } },
      { aggregate_id: '2', aggregate_version: 1, name: 'UserCreatedV1', body: { name: 'John Doe' } },
      { aggregate_id: '2', aggregate_version: 2, name: 'UserUpdated', body: { name: 'John Smith' } }
    ]

    let repo: EventStoreRepository

    beforeAll(async () => {
      repo = new EventStoreRepository(db, logger)
      await repo.onModuleInit()
      await db.table('events').insert(EVENTS_MOCK.map((e) => ({ ...e, body: JSON.stringify(e.body) })))
    })

    const testCases = [
      {
        description: 'should return an event for the aggregate with ID = 1',
        id: '1',
        expected: [{ aggregateId: '1', aggregateVersion: 1, name: 'UserCreatedV1', body: { name: 'John Doe' } }]
      },
      {
        description: 'should return events for the aggregate with ID = 2',
        id: '2',
        expected: [
          { aggregateId: '2', aggregateVersion: 1, name: 'UserCreatedV1', body: { name: 'John Doe' } },
          { aggregateId: '2', aggregateVersion: 2, name: 'UserUpdated', body: { name: 'John Smith' } }
        ]
      },
      {
        description: 'should return empty array for the aggregate with ID = 3',
        id: '3',
        expected: []
      },
      {
        description: 'should return empty array for the aggregate with no ID',
        id: '',
        expected: []
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repo.getEventsByAggregateId(id)
      expect(result.length).toEqual(expected.length)
      expect(result.map((r) => r.name).sort((a, b) => a.localeCompare(b))).toEqual(
        expected.map((e) => e.name).sort((a, b) => a.localeCompare(b))
      )
    })
  })

  describe('saveEvents', () => {
    const EVENTS_MOCK: Event[] = [
      { aggregateId: '123', aggregateVersion: 1, version: 1, toJson: () => JSON.stringify({ name: 'John Doe' }) },
      { aggregateId: '123', aggregateVersion: 2, version: 1, toJson: () => JSON.stringify({ name: 'John Smith' }) }
    ]

    let repo: EventStoreRepository

    beforeAll(async () => {
      repo = new EventStoreRepository(db, logger)
      await repo.onModuleInit()
    })

    const testCases = [
      {
        description: 'should save new events',
        id: '4',
        events: EVENTS_MOCK,
        expected: true,
        saved: [
          { aggregate_id: '4', body: JSON.stringify({ name: 'John Doe' }), version: 1, aggregate_version: 1 },
          { aggregate_id: '4', body: JSON.stringify({ name: 'John Smith' }), version: 1, aggregate_version: 2 }
        ]
      },
      {
        description: 'should not save events with no ID',
        id: '',
        events: EVENTS_MOCK,
        expected: false,
        saved: []
      }
    ]
    test.each(testCases)('$description', async ({ id, events, expected, saved }) => {
      const result = await repo.saveEvents(id, events)
      expect(result).toEqual(expected)

      const savedData = await db.table('events').where({ aggregate_id: id })
      expect(savedData.sort()).toMatchObject(saved.sort())
    })
  })
})
