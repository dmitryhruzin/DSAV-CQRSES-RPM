import { jest } from '@jest/globals'
import knex from 'knex'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { OrderMainProjection } from './order-main.projection.js'

describe('OrderMainProjection', () => {
  const knexMock: knex.Knex = {} as knex.Knex
  const loggerMock = { info: jest.fn(), warn: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create table if not exists on module init', async () => {
    knexMock.schema = {
      ...knexMock.schema,
      hasTable: jest.fn().mockImplementation(() => false) as jest.Mocked<typeof knexMock.schema.hasTable>,
      createTable: jest.fn().mockImplementation(() => undefined) as jest.Mocked<typeof knexMock.schema.createTable>
    }

    const projection = new OrderMainProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)
    await projection.onModuleInit()

    expect(knexMock.schema.hasTable).toHaveBeenCalledWith('orders')
    expect(knexMock.schema.createTable).toHaveBeenCalledTimes(2)
  })

  it('should save a record', async () => {
    const insert = jest.fn()
    knexMock.table = jest.fn().mockImplementation(() => ({ insert })) as jest.Mocked<typeof knexMock.table>

    const projection = new OrderMainProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)
    await projection.save({ id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false, version: 1 })

    expect(knexMock.table).toHaveBeenCalledWith('orders')
    expect(insert).toHaveBeenCalledWith([
      { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false, version: 1 }
    ])
  })

  describe('update', () => {
    const testCases = [
      {
        description: 'should get a record by id',
        payload: { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false, version: 2 },
        record: { version: 1 }
      },
      {
        description: 'should get a record by id',
        payload: { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false, version: 2 },
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

      const projection = new OrderMainProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)

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

    const projection = new OrderMainProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)
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
        payload: { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false },
        expected: { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false }
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

      const projection = new OrderMainProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)

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
    const eventStore = {
      getEventsByName: jest
        .fn()
        .mockReturnValueOnce([
          { id: 1, aggregateId: '1', name: 'OrderCreated', body: { id: '1', title: 'Order 1', price: '20.00', discount: '0', priority: 1, status: 'new', approved: false } },
          {
            id: 2,
            aggregateId: '1',
            name: 'OrderPriceChanged',
            body: { id: '1', previousPrice: '20.00', price: '30.00' }
          },
          { id: 3, aggregateId: '1', name: 'OrderDiscountApplied', body: { id: '1', discount: '10.00', previousDiscount: '5.00' } },
          { id: 4, aggregateId: '1', name: 'OrderPrioritySet', body: { id: '1', previousPriority: 1, priority: 2 } },
          {
            id: 5,
            aggregateId: '1',
            name: 'OrderStatusChanged',
            body: { id: '1', previousStatus: 'new', status: 'processing' }
          },
          { id: 6, aggregateId: '1', name: 'OrderApproved', body: { id: '1', approved: true } },
          { id: 7, aggregateId: '2', name: 'OrderCreated', body: { id: '2' } },
          { id: 8, aggregateId: '2', name: 'OrderPriceChanged', body: { id: '2' } },
          { id: 9, aggregateId: '2', name: 'OrderDiscountApplied', body: { id: '2' } },
          { id: 10, aggregateId: '2', name: 'OrderPrioritySet', body: { id: '2' } },
          { id: 11, aggregateId: '2', name: 'OrderStatusChanged', body: { id: '2' } },
          { id: 12, aggregateId: '2', name: 'OrderApproved', body: { id: '2' } }
        ])
        .mockReturnValue([])
    } as unknown as EventStoreRepository

    const projection = new OrderMainProjection(eventStore, knexMock as any, loggerMock as any)
    projection.applySnapshot = jest.fn() as jest.Mocked<typeof projection.applySnapshot>
    projection.createSnapshot = jest.fn() as jest.Mocked<typeof projection.createSnapshot>
    projection.save = jest.fn() as jest.Mocked<typeof projection.save>
    projection.update = jest.fn() as jest.Mocked<typeof projection.update>

    await projection.rebuild()

    expect(projection.save).toHaveBeenCalledTimes(1)
    expect(projection.update).toHaveBeenCalledTimes(5)
    expect(eventStore.getEventsByName).toHaveBeenCalledTimes(2)
    expect(projection.createSnapshot).toHaveBeenCalledTimes(1)
    expect(projection.applySnapshot).toHaveBeenCalledTimes(1)
    expect(loggerMock.warn).toHaveBeenCalledTimes(6)
  })
})
