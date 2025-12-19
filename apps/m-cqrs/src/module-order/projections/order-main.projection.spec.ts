import { jest } from '@jest/globals'
import knex from 'knex'
import { OrderMainProjection } from './order-main.projection.js'

describe('OrderMainProjection', () => {
  const knexMock: knex.Knex = {} as knex.Knex
  const loggerMock = { info: jest.fn(), warn: jest.fn() }

  beforeEach(() => {})

  it('should create table if not exists on module init', async () => {
    knexMock.schema = {
      ...knexMock.schema,
      hasTable: jest.fn().mockImplementation(() => false) as jest.Mocked<typeof knexMock.schema.hasTable>,
      createTable: jest.fn().mockImplementation(() => undefined) as jest.Mocked<typeof knexMock.schema.createTable>
    }

    const projection = new OrderMainProjection(knexMock as any, loggerMock as any)
    await projection.onModuleInit()

    expect(knexMock.schema.hasTable).toHaveBeenCalledWith('orders')
    expect(knexMock.schema.createTable).toHaveBeenCalled()
  })

  it('should save a record', async () => {
    const insert = jest.fn()
    knexMock.table = jest.fn().mockImplementation(() => ({ insert })) as jest.Mocked<typeof knexMock.table>

    const projection = new OrderMainProjection(knexMock as any, loggerMock as any)
    await projection.save({
      id: '1',
      title: 'Order 1',
      price: '20.00',
      discount: '0',
      priority: 1,
      status: 'new',
      approved: false,
      version: 1
    })

    expect(knexMock.table).toHaveBeenCalledWith('orders')
    expect(insert).toHaveBeenCalledWith([
      {
        deleted_at: undefined,
        id: '1',
        title: 'Order 1',
        price: '20.00',
        discount: '0',
        priority: 1,
        status: 'new',
        approved: false,
        version: 1
      }
    ])
  })

  describe('update', () => {
    const testCases = [
      {
        description: 'should get a record by id',
        payload: {
          id: '1',
          title: 'Order 1',
          price: '20.00',
          discount: '0',
          priority: 1,
          status: 'new',
          approved: false,
          version: 2
        },
        record: { version: 1 }
      },
      {
        description: 'should get a record by id',
        payload: {
          id: '1',
          title: 'Order 1',
          price: '20.00',
          discount: '0',
          priority: 1,
          status: 'new',
          approved: false,
          version: 2
        },
        record: { version: 2 },
        expectedWarn: `Version mismatch for Order with id: 1, current version: 2, new version: 2`
      }
    ]
    test.each(testCases)('$description', async ({ payload, record, expectedWarn }) => {
      const trx = { commit: jest.fn(), rollback: jest.fn() }
      knexMock.transaction = jest.fn().mockImplementation(() => trx) as jest.Mocked<typeof knexMock.transaction>

      const updateWhere = jest.fn().mockImplementation(() => ({}))
      const update = jest.fn().mockImplementation(() => ({ where: updateWhere }))

      const first = jest.fn().mockImplementation(() => record)
      const forUpdateWhere = jest.fn().mockImplementation(() => ({ first }))
      const forUpdate = jest.fn().mockImplementation(() => ({ where: forUpdateWhere }))
      const transacting = jest.fn().mockImplementation(() => ({ forUpdate, update }))
      knexMock.table = jest.fn().mockImplementation(() => ({ transacting })) as jest.Mocked<typeof knexMock.table>

      const projection = new OrderMainProjection(knexMock as any, loggerMock as any)

      const result = await projection.update('1', payload)

      expect(result).toEqual(true)

      if (expectedWarn) {
        expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ message: expectedWarn }))
        expect(trx.rollback).toHaveBeenCalledTimes(4)
      } else {
        expect(loggerMock.warn).not.toHaveBeenCalled()
        expect(trx.commit).toHaveBeenCalled()
      }
    })
  })

  it('should get all records paginated', async () => {
    const offset = jest.fn().mockImplementation(() => [
      { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false },
      { id: '2', title: 'Order 2', price: '30.00', discount: '5', priority: 2, status: 'processing', approved: true }
    ])
    const first = jest.fn().mockImplementation(() => ({ count: 4 }))
    const count = jest.fn().mockImplementation(() => ({ first }))
    const limit = jest.fn().mockImplementation(() => ({ offset }))
    const select = jest.fn().mockImplementation(() => ({ limit }))
    knexMock.table = jest.fn().mockImplementation(() => ({ select, count })) as jest.Mocked<typeof knexMock.table>

    const projection = new OrderMainProjection(knexMock as any, loggerMock as any)
    const result = await projection.getAll(1, 2)

    expect(result.items.length).toBe(2)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(2)
    expect(result.total).toBe(4)
  })

  describe('getById', () => {
    const testCases = [
      {
        description: 'should get a record by id',
        payload: {
          id: '1',
          title: 'Order 1',
          price: '20.00',
          discount: '0',
          priority: 1,
          status: 'new',
          approved: false
        },
        expected: {
          id: '1',
          title: 'Order 1',
          price: '20.00',
          discount: '0',
          priority: 1,
          status: 'new',
          approved: false
        }
      },
      {
        description: 'should throw if record by id not found',
        payload: undefined,
        expectedError: 'Order with id: notfound not found'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      const first = jest.fn().mockImplementation(() => payload)
      const where = jest.fn().mockImplementation(() => ({ first }))
      const select = jest.fn().mockImplementation(() => ({ where }))
      knexMock.table = jest.fn().mockImplementation(() => ({ select })) as jest.Mocked<typeof knexMock.table>

      const projection = new OrderMainProjection(knexMock as any, loggerMock as any)

      if (expectedError) {
        await expect(projection.getById('1')).rejects.toThrow('Order with id: 1 not found')
      }
      if (expected) {
        const result = await projection.getById('1')

        expect(result).toEqual(expected)
      }
    })
  })

  it('should rebuild projection', async () => {
    const whereOrderByLimit = jest.fn().mockImplementation(() => [])
    const whereOrderBy = jest.fn().mockImplementation(() => ({ limit: whereOrderByLimit }))
    const where = jest.fn().mockImplementation(() => ({ orderBy: whereOrderBy }))

    const insert = jest.fn()

    const tableOrderByLimit = jest.fn().mockImplementation(() => [
      {
        id: '1',
        title: 'Order 1',
        price: '20.00',
        discount: '0',
        priority: 1,
        status: 'new',
        approved: false,
        version: 1,
        deleted_at: null
      },
      {
        id: '2',
        title: 'Order 2',
        price: '30.00',
        discount: '5',
        priority: 2,
        status: 'processing',
        approved: true,
        version: 1,
        deleted_at: null
      }
    ])
    const tableOrderBy = jest.fn().mockImplementation(() => ({ limit: tableOrderByLimit }))

    const del = jest.fn().mockImplementation(() => ({}))
    knexMock.table = jest.fn().mockImplementation(() => ({ del, orderBy: tableOrderBy, insert, where })) as jest.Mocked<
      typeof knexMock.table
    >

    const projection = new OrderMainProjection(knexMock as any, loggerMock as any)
    await projection.rebuild()

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith([
      {
        id: '1',
        title: 'Order 1',
        price: '20.00',
        discount: '0',
        priority: 1,
        status: 'new',
        approved: false,
        version: 1,
        deleted_at: null
      },
      {
        id: '2',
        title: 'Order 2',
        price: '30.00',
        discount: '5',
        priority: 2,
        status: 'processing',
        approved: true,
        version: 1,
        deleted_at: null
      }
    ])
    expect(loggerMock.info).toHaveBeenCalledWith('Rebuild projection finished!')
  })
})
