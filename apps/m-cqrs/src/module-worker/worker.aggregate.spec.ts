import { jest } from '@jest/globals'
import { WorkerAggregate } from './worker.aggregate.js'
import { ChangeWorkerHourlyRateCommand, ChangeWorkerRoleCommand, HireWorkerCommand } from './commands/index.js'

describe('WorkerAggregate', () => {
  describe('toJson', () => {
    const testCases = [
      {
        description: 'should return a js Object',
        getAggregate: () => {
          const aggregate = new WorkerAggregate()
          aggregate.hire(
            new HireWorkerCommand({
              hourlyRate: '15.00',
              role: 'manager'
            })
          )
          return aggregate
        },
        expected: { hourlyRate: '15.00', role: 'manager' }
      },
      {
        description: 'should return an error for empty aggregate',
        getAggregate: () => new WorkerAggregate(),
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

  describe('hire', () => {
    let aggregate: WorkerAggregate

    beforeEach(() => {
      aggregate = new WorkerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should not create if hourlyRate is not valid',
        payload: {
          hourlyRate: '15.000', // invalid hourly rate
          role: 'manager'
        },
        expectedError: 'Invalid hourly rate'
      },
      {
        description: 'should not create if role is not valid',
        payload: {
          hourlyRate: '15.00',
          role: '  manager. ' // invalid role
        },
        expectedError: 'Invalid role'
      },
      {
        description: 'should create new aggregate with new ID',
        payload: {
          hourlyRate: '15.00',
          role: 'manager'
        },
        expected: {
          hourlyRate: '15.00',
          role: 'manager'
        }
      },
      {
        description: 'should build an aggregate using existing event',
        payload: {
          id: '1',
          hourlyRate: '15.00',
          role: 'manager'
        },
        expected: {
          id: '1',
          hourlyRate: '15.00',
          role: 'manager'
        }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.hire(new HireWorkerCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.hire(new HireWorkerCommand(payload))

        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().hourlyRate).toEqual(expected.hourlyRate)
        expect(result[0].toJson().role).toEqual(expected.role)
      }
    })
  })

  describe('changeRole', () => {
    let aggregate: WorkerAggregate

    beforeEach(() => {
      aggregate = new WorkerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should change role for existing aggregate',
        payload: { id: '1', role: 'washer' },
        expected: { role: 'washer' }
      },
      {
        description: 'should not change role if role is not valid',
        payload: { id: '1', role: '  manager. ' },
        expectedError: 'Invalid role'
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.changeRole(new ChangeWorkerRoleCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const command = new ChangeWorkerRoleCommand(payload)

        const result = aggregate.changeRole(command)
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().role).toEqual(expected.role)
      }
    })
  })

  describe('changeHourlyRate', () => {
    let aggregate: WorkerAggregate

    beforeEach(() => {
      aggregate = new WorkerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should update hourlyRate for existing aggregate',
        payload: { id: '1', hourlyRate: '20.00' },
        expected: { hourlyRate: '20.00' }
      },
      {
        description: 'should not change hourlyRate if hourlyRate is not valid',
        payload: { id: '1', hourlyRate: '20' },
        expectedError: 'Invalid hourly rate'
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.changeHourlyRate(new ChangeWorkerHourlyRateCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const command = new ChangeWorkerHourlyRateCommand(payload)

        const result = aggregate.changeHourlyRate(command)
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().hourlyRate).toEqual(expected.hourlyRate)
      }
    })
  })

  describe('dismiss', () => {
    let aggregate: WorkerAggregate

    beforeEach(() => {
      aggregate = new WorkerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should dismiss existing aggregate',
        payload: { id: '1' }
      }
    ]
    test.each(testCases)('$description', () => {
      const result = aggregate.dismiss()
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().deletedAt).toBeTruthy()
    })
  })
})
