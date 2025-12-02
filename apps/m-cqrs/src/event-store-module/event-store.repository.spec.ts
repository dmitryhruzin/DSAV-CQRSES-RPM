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
        saved: [
          { aggregateId: '4', body: JSON.stringify({ name: 'John Doe' }), version: 1, aggregateVersion: 1 },
          { aggregateId: '4', body: JSON.stringify({ name: 'John Smith' }), version: 1, aggregateVersion: 2 }
        ]
      },
      {
        description: 'should not save events with no ID',
        id: '',
        events: EVENTS_MOCK,
        saved: [],
        error: true
      }
    ]
    test.each(testCases)('$description', async ({ id, events, saved, error }) => {
      const trx = await db.transaction()

      if (error) {
        await expect(repo.saveEvents(id, events, trx)).rejects.toThrow()
        await trx.rollback()
      } else {
        await expect(repo.saveEvents(id, events, trx)).resolves.not.toThrow()
        await trx.commit()
      }

      const savedData = await db.table('events').where({ aggregateId: id })
      expect(savedData.sort()).toMatchObject(saved.sort())
    })
  })
})
