import { jest } from '@jest/globals'
import { CarAggregate } from './car.aggregate.js'
import { ChangeCarOwnerCommand, CreateCarCommand, RecordCarMileageCommand } from './commands/index.js'

describe('CarAggregate', () => {
  describe('toJson', () => {
    const testCases = [
      {
        description: 'should return a js Object',
        getAggregate: () => {
          const aggregate = new CarAggregate()
          aggregate.create(
            new CreateCarCommand({
              vin: '1HGCM82633A123456',
              registrationNumber: 'AB1234AA',
              mileage: 10000,
              ownerID: '1'
            })
          )
          return aggregate
        },
        expected: { vin: '1HGCM82633A123456', registrationNumber: 'AB1234AA', mileage: 10000, ownerID: '1' }
      },
      {
        description: 'should return an error for empty aggregate',
        getAggregate: () => new CarAggregate(),
        expectedError: 'Aggregate is empty'
      }
    ]
    test.each(testCases)('$description', ({ getAggregate, expected, expectedError }) => {
      try {
        const result = getAggregate().toJson()
        if (expected) {
          expect(result).toMatchObject(expected)
        }

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

  describe('create', () => {
    let aggregate: CarAggregate

    beforeEach(() => {
      aggregate = new CarAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should not create if vin is not valid',
        payload: {
          vin: '1HGCM82633A123', // invalid VIN
          registrationNumber: 'AB1231AA',
          mileage: 10000,
          ownerID: '1'
        },
        expectedError: 'Invalid VIN'
      },
      {
        description: 'should not create if registrationNumber is not valid',
        payload: {
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB12AA', // invalid registration number
          mileage: 10000,
          ownerID: '1'
        },
        expectedError: 'Invalid registration number'
      },
      {
        description: 'should not create if mileage is not valid',
        payload: {
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: -100, // invalid mileage
          ownerID: '1'
        },
        expectedError: 'Invalid mileage'
      },
      {
        description: 'should create new aggregate with new ID',
        payload: {
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        },
        expected: {
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        }
      },
      {
        description: 'should build an aggregate using existing event',
        payload: {
          id: '1',
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        },
        expected: {
          id: '1',
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.create(new CreateCarCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.create(new CreateCarCommand(payload))

        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().ownerID).toEqual(expected.ownerID)
      }
    })
  })

  describe('recordMileage', () => {
    let aggregate: CarAggregate

    beforeEach(() => {
      aggregate = new CarAggregate()
      aggregate.create(
        new CreateCarCommand({
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        })
      )
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should update mileage for existing aggregate',
        payload: { id: '1', mileage: 15000 },
        expected: { mileage: 15000 }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected }) => {
      const command = new RecordCarMileageCommand(payload)

      const result = aggregate.recordMileage(command)
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().mileage).toEqual(expected.mileage)
    })
  })

  describe('changeOwner', () => {
    let aggregate: CarAggregate

    beforeEach(() => {
      aggregate = new CarAggregate()
      aggregate.create(
        new CreateCarCommand({
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        })
      )
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should change owner for existing aggregate',
        payload: { id: '1', ownerID: '2' },
        expected: { ownerID: '2' }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected }) => {
      const command = new ChangeCarOwnerCommand(payload)

      const result = aggregate.changeOwner(command)
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().ownerID).toEqual(expected.ownerID)
    })
  })

  describe('delete', () => {
    let aggregate: CarAggregate

    beforeEach(() => {
      aggregate = new CarAggregate()
      aggregate.create(
        new CreateCarCommand({
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        })
      )
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should delete existing aggregate',
        payload: { id: '1' }
      }
    ]
    test.each(testCases)('$description', () => {
      const result = aggregate.delete()
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().deletedAt).toBeTruthy()
      expect(result[0].aggregateVersion).toEqual(2)
    })
  })
})
