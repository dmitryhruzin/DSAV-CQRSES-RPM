import knex from 'knex'
import { testConfig } from '../../../knexfile.js'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { AggregateSnapshotRepository } from './aggregate-snapshot.repository.js'
import { UserAggregate } from '../../module-user/user.aggregate.js'

describe('AggregateSnapshotRepository', () => {
  const logger = new Logger({})
  let db: knex.Knex

  beforeAll(() => {
    db = knex(testConfig)
  })

  afterAll(async () => {
    await db.schema.dropTable('snapshots')
    await db.destroy()
  })

  describe('getLatestSnapshotByAggregateId', () => {
    const AGGREGATES_MOCK = [
      { aggregateId: '1', aggregateVersion: 1, state: { name: 'John Doe' } },
      { aggregateId: '1', aggregateVersion: 2, state: { name: 'John Doe Updated' } },
      { aggregateId: '2', aggregateVersion: 1, state: { name: 'John Doe' } }
    ]

    let repo: AggregateSnapshotRepository

    beforeAll(async () => {
      repo = new AggregateSnapshotRepository(db, logger)
      await repo.onModuleInit()
      await db.table('snapshots').insert(AGGREGATES_MOCK.map((a) => ({ ...a, state: JSON.stringify(a.state) })))
    })

    const testCases = [
      {
        description: 'should return the latest snapsot for the aggregate with ID = 1',
        id: '1',
        expected: { ...AGGREGATES_MOCK[1], state: { name: 'John Doe Updated' } }
      },
      {
        description: 'should return the latest snatshot for the aggregate with ID = 2',
        id: '2',
        expected: { ...AGGREGATES_MOCK[2], state: { name: 'John Doe' } }
      },
      {
        description: 'should return null value for the aggregate with ID = 3',
        id: '3',
        expected: null
      }
    ]
    test.each(testCases)('$description', async ({ id, expected }) => {
      const result = await repo.getLatestSnapshotByAggregateId(id)

      if (!expected) {
        expect(result).toEqual(expected)
      } else {
        expect(result).toMatchObject(expected)
      }
    })
  })

  describe('saveSnapshot', () => {
    const mockedAggregate = new UserAggregate()
    mockedAggregate.id = '1234'
    mockedAggregate.version = 1

    let repo: AggregateSnapshotRepository

    beforeAll(async () => {
      repo = new AggregateSnapshotRepository(db, logger)
      await repo.onModuleInit()
    })

    const testCases = [
      {
        description: 'should save new aggregate',
        aggregate: mockedAggregate,
        expected: true,
        saved: { aggregateId: '1234', aggregateVersion: 1, state: '{\"id\":\"1234\",\"version\":1}' }
      }
    ]
    test.each(testCases)('$description', async ({ aggregate, expected, saved }) => {
      const result = await repo.saveSnapshot(aggregate)
      expect(result).toEqual(expected)

      const savedData = await db.table('snapshots').where({ aggregateId: aggregate.id })
      expect(savedData[0]).toMatchObject(saved)
    })
  })
})
