import { jest } from '@jest/globals'
import knex from 'knex'
import { CustomerWithCarsProjection } from './customer-with-cars.projection.js'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { version } from 'uuid'

describe('CustomerWithCarsProjection', () => {
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

    const projection = new CustomerWithCarsProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)
    await projection.onModuleInit()

    expect(knexMock.schema.hasTable).toHaveBeenCalledWith('customer-with-cars')
    expect(knexMock.schema.createTable).toHaveBeenCalled()
  })

  it('should save a record', async () => {
    const insert = jest.fn()
    knexMock.table = jest.fn().mockImplementation(() => ({ insert })) as jest.Mocked<typeof knexMock.table>

    const projection = new CustomerWithCarsProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)
    await projection.save({
      customerID: '1',
      userID: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+1234567890',
      customerVersion: 1,
      carID: '1',
      vin: '1HGCM82633A123456',
      registrationNumber: 'ABC123',
      mileage: 10000,
      carVersion: 1
    })

    expect(knexMock.table).toHaveBeenCalledWith('customer-with-cars')
    expect(insert).toHaveBeenCalledWith([
      {
        id: '1-1',
        customer_id: '1',
        user_id: 'user1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone_number: '+1234567890',
        customer_version: 1,
        car_id: '1',
        vin: '1HGCM82633A123456',
        registration_number: 'ABC123',
        mileage: 10000,
        car_version: 1,
        car_deleted_at: undefined,
        customer_deleted_at: undefined
      }
    ])
  })

  describe('updateCar', () => {
    const testCases = [
      {
        description: 'should update a record',
        payload: {
          carID: '1',
          vin: '1HGCM82633A123456',
          mileage: 10000,
          registrationNumber: 'ABC123',
          carVersion: 2
        },
        expected: {
          car_id: '1',
          vin: '1HGCM82633A123456',
          registration_number: 'ABC123',
          mileage: 10000,
          car_version: 2
        },
        record: { car_version: 1 }
      },
      {
        description: 'should throw a VersionMismatchError',
        payload: {
          carID: '1',
          vin: '1HGCM82633A123456',
          mileage: 10000,
          registrationNumber: 'ABC123',
          carVersion: 2
        },
        record: { car_version: 2 },
        expectedWarn: `Version mismatch for Car with id: 1, current version: 2, new version: 2`
      }
    ]
    test.each(testCases)('$description', async ({ payload, record, expected, expectedWarn }) => {
      const trx = { commit: jest.fn(), rollback: jest.fn() }
      knexMock.transaction = jest.fn().mockImplementation(() => trx) as jest.Mocked<typeof knexMock.transaction>

      const updateWhere = jest.fn().mockImplementation(() => ({}))
      const update = jest.fn().mockImplementation(() => ({ where: updateWhere }))

      const first = jest.fn().mockImplementation(() => record)
      const forUpdateWhere = jest.fn().mockImplementation(() => ({ first }))
      const forUpdate = jest.fn().mockImplementation(() => ({ where: forUpdateWhere }))
      const transacting = jest.fn().mockImplementation(() => ({ forUpdate, update }))
      knexMock.table = jest.fn().mockImplementation(() => ({ transacting })) as jest.Mocked<typeof knexMock.table>

      const projection = new CustomerWithCarsProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)

      const result = await projection.updateCar('1', payload)

      expect(result).toEqual(true)

      if (expectedWarn) {
        expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ message: expectedWarn }))
        expect(trx.rollback).toHaveBeenCalledTimes(4)
      } else {
        expect(loggerMock.warn).not.toHaveBeenCalled()
        expect(update).toHaveBeenCalledWith(expected)
        expect(trx.commit).toHaveBeenCalled()
      }
    })
  })

  describe('updateCustomer', () => {
    const testCases = [
      {
        description: 'should update a record',
        payload: {
          customerID: '1',
          userID: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890',
          customerVersion: 2
        },
        expected: {
          customer_id: '1',
          user_id: 'user1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          phone_number: '+1234567890',
          customer_version: 2
        },
        record: { customer_version: 1 }
      },
      {
        description: 'should throw a VersionMismatchError',
        payload: {
          customerID: '1',
          userID: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890',
          customerVersion: 2
        },
        expected: {},
        record: { customer_version: 2 },
        expectedWarn: `Version mismatch for Customer with id: 1, current versions: 2, new version: 2`
      }
    ]
    test.each(testCases)('$description', async ({ payload, record, expected, expectedWarn }) => {
      const trx = { commit: jest.fn(), rollback: jest.fn() }
      knexMock.transaction = jest.fn().mockImplementation(() => trx) as jest.Mocked<typeof knexMock.transaction>

      const updateWhere = jest.fn().mockImplementation(() => ({}))
      const update = jest.fn().mockImplementation(() => ({ where: updateWhere }))

      const forUpdateWhere = jest.fn().mockImplementation(() => [record])
      const forUpdate = jest.fn().mockImplementation(() => ({ where: forUpdateWhere }))
      const transacting = jest.fn().mockImplementation(() => ({ forUpdate, update }))
      knexMock.table = jest.fn().mockImplementation(() => ({ transacting })) as jest.Mocked<typeof knexMock.table>

      const projection = new CustomerWithCarsProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)

      const result = await projection.updateCustomer('1', payload)

      expect(result).toEqual(true)

      if (expectedWarn) {
        expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ message: expectedWarn }))
        expect(trx.rollback).toHaveBeenCalledTimes(4)
      } else {
        expect(loggerMock.warn).not.toHaveBeenCalled()
        expect(update).toHaveBeenCalledWith(expected)
        expect(trx.commit).toHaveBeenCalled()
      }
    })
  })

  describe('getByCustomerId', () => {
    const testCases = [
      {
        description: 'should get a record by id',
        payload: {
          id: '1-1',
          customer_id: '1',
          user_id: 'user1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          phone_number: '+1234567890',
          customer_version: 1,
          cars: [
            {
              car_id: '1',
              vin: '1HGCM82633A123456',
              registration_number: 'ABC123',
              mileage: 10000,
              car_version: 1
            },
            {
              car_id: '2',
              vin: '2HGCM82633A123456',
              registration_number: 'DEF456',
              mileage: 20000,
              car_version: 2
            }
          ]
        },
        expected: {
          id: '1',
          userID: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890',
          cars: [
            {
              id: '1',
              vin: '1HGCM82633A123456',
              registrationNumber: 'ABC123',
              mileage: 10000
            },
            {
              id: '2',
              vin: '2HGCM82633A123456',
              registrationNumber: 'DEF456',
              mileage: 20000
            }
          ]
        }
      },
      {
        description: 'should throw if record by id not found',
        payload: undefined,
        expectedError: 'Customer with id: notfound not found'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      const first = jest.fn().mockImplementation(() => payload)
      const groupBy = jest.fn().mockImplementation(() => ({ first }))
      const whereNullwhereNull = jest.fn().mockImplementation(() => ({ groupBy }))
      const whereNull = jest.fn().mockImplementation(() => ({ whereNull: whereNullwhereNull }))
      const where = jest.fn().mockImplementation(() => ({ whereNull }))
      const selectSelect = jest.fn().mockImplementation(() => ({ where }))
      const select = jest.fn().mockImplementation(() => ({ select: selectSelect }))
      knexMock.table = jest.fn().mockImplementation(() => ({ select })) as jest.Mocked<typeof knexMock.table>
      knexMock.raw = jest.fn().mockImplementation(() => ({})) as jest.Mocked<typeof knexMock.raw>

      const projection = new CustomerWithCarsProjection({} as EventStoreRepository, knexMock as any, loggerMock as any)

      if (expectedError) {
        await expect(projection.getByCustomerId('1')).rejects.toThrow('Customer with id: 1 not found')
      }
      if (expected) {
        const result = await projection.getByCustomerId('1')

        expect(result).toEqual(expected)
      }
    })
  })

  it('should rebuild projection', async () => {
    const eventStore = {
      getEventsByName: jest
        .fn()
        .mockReturnValueOnce([
          {
            id: 1,
            aggregateId: '1',
            name: 'CarCreated',
            body: {
              id: '1',
              vin: '1HGCM82633A123456',
              registrationNumber: 'ABC123',
              mileage: 10000,
              owner: {
                id: '1',
                userID: 'user1',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                phoneNumber: '+1234567890',
                version: 1
              }
            }
          },
          {
            id: 2,
            aggregateId: '1',
            name: 'CarOwnerChanged',
            body: {
              id: '1',
              previousOwnerID: '1',
              ownerID: '2',
              owner: {
                id: '2',
                userID: 'user2',
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@example.com',
                phoneNumber: '+0987654321',
                version: 1
              }
            }
          },
          {
            id: 3,
            aggregateId: '1',
            name: 'CarMileageRecorded',
            body: { id: '1', mileage: 15000, previousMileage: 10000 }
          },
          {
            id: 4,
            aggregateId: '1',
            name: 'CarDeleted',
            body: { id: '1', deletedAt: new Date() }
          },
          {
            id: 5,
            aggregateId: '1',
            name: 'CustomerRenamed',
            body: { id: '1', previousFirstName: 'Johnny', previousLastName: 'Doe', firstName: 'John', lastName: 'Doe' }
          },
          {
            id: 6,
            aggregateId: '1',
            name: 'CustomerContactsChanged',
            body: {
              id: '1',
              previousEmail: 'john.old@example.com',
              email: 'john.doe@example.com',
              previousPhoneNumber: '+0987654321',
              phoneNumber: '+1234567890'
            }
          },
          { id: 7, aggregateId: '1', name: 'CustomerDeleted', body: { id: '1', deletedAt: new Date() } },
          { id: 8, aggregateId: '2', name: 'CarCreated', body: { id: '2' } },
          { id: 9, aggregateId: '2', name: 'CarOwnerChanged', body: { id: '2' } },
          { id: 10, aggregateId: '2', name: 'CarMileageRecorded', body: { id: '2' } },
          { id: 11, aggregateId: '2', name: 'CarDeleted', body: { id: '2' } },
          { id: 12, aggregateId: '2', name: 'CustomerRenamed', body: { id: '2' } },
          { id: 13, aggregateId: '2', name: 'CustomerContactsChanged', body: { id: '2' } },
          { id: 14, aggregateId: '2', name: 'CustomerDeleted', body: { id: '2' } }
        ])
        .mockReturnValue([])
    } as unknown as EventStoreRepository

    const projection = new CustomerWithCarsProjection(eventStore, knexMock as any, loggerMock as any)
    projection.applySnapshot = jest.fn() as jest.Mocked<typeof projection.applySnapshot>
    projection.createSnapshot = jest.fn() as jest.Mocked<typeof projection.createSnapshot>
    projection.save = jest.fn() as jest.Mocked<typeof projection.save>
    projection.updateCar = jest.fn() as jest.Mocked<typeof projection.updateCar>
    projection.updateCustomer = jest.fn() as jest.Mocked<typeof projection.updateCustomer>

    await projection.rebuild()

    expect(projection.save).toHaveBeenCalledTimes(1)
    expect(projection.updateCar).toHaveBeenCalledTimes(3)
    expect(projection.updateCustomer).toHaveBeenCalledTimes(3)
    expect(eventStore.getEventsByName).toHaveBeenCalledTimes(2)
    expect(projection.createSnapshot).toHaveBeenCalledTimes(1)
    expect(projection.applySnapshot).toHaveBeenCalledTimes(1)
    expect(loggerMock.warn).toHaveBeenCalledTimes(7)
  })
})
