import { jest } from '@jest/globals'
import { CustomerAggregate } from './customer.aggregate.js'
import { ChangeCustomerContactsCommand, CreateCustomerCommand, RenameCustomerCommand } from './commands/index.js'

describe('CustomerAggregate', () => {
  describe('toJson', () => {
    const testCases = [
      {
        description: 'should return a js Object',
        getAggregate: () => {
          const aggregate = new CustomerAggregate()
          aggregate.create(new CreateCustomerCommand({ userID: '1', firstName: 'John', lastName: 'Doe' }))
          return aggregate
        },
        expected: { userID: '1', firstName: 'John', lastName: 'Doe' }
      },
      {
        description: 'should return an error for empty aggregate',
        getAggregate: () => new CustomerAggregate(),
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
    let aggregate: CustomerAggregate

    beforeEach(() => {
      aggregate = new CustomerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should not create if email is not valid',
        payload: {
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          phoneNumber: '+1234567890'
        },
        expectedError: 'Invalid email'
      },
      {
        description: 'should not create if phoneNumber is not valid',
        payload: {
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: 'invalid-phone'
        },
        expectedError: 'Invalid phone number'
      },
      {
        description: 'should create new aggregate with new ID',
        payload: {
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        },
        expected: {
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        }
      },
      {
        description: 'should build an aggregate using existing event',
        payload: {
          id: '1',
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        },
        expected: {
          id: '1',
          userID: '1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.create(new CreateCustomerCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.create(new CreateCustomerCommand(payload))

        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().userID).toEqual(expected.userID)
      }
    })
  })

  describe('rename', () => {
    let aggregate: CustomerAggregate

    beforeEach(() => {
      aggregate = new CustomerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should rename for existing aggregate',
        payload: { id: '1', firstName: 'Jane', lastName: 'Smith' },
        expected: { firstName: 'Jane', lastName: 'Smith' }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected }) => {
      const command = new RenameCustomerCommand(payload)

      const result = aggregate.rename(command)
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().firstName).toEqual(expected.firstName)
      expect(result[0].toJson().lastName).toEqual(expected.lastName)
    })
  })

  describe('changeContacts', () => {
    let aggregate: CustomerAggregate

    beforeEach(() => {
      aggregate = new CustomerAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should change contacts for existing aggregate',
        payload: { id: '1', email: 'jane.smith@example.com', phoneNumber: '+1987654321' },
        expected: { email: 'jane.smith@example.com', phoneNumber: '+1987654321' }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected }) => {
      const command = new ChangeCustomerContactsCommand(payload)

      const result = aggregate.changeContacts(command)
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().email).toEqual(expected.email)
      expect(result[0].toJson().phoneNumber).toEqual(expected.phoneNumber)
    })
  })

  describe('delete', () => {
    let aggregate: CustomerAggregate

    beforeEach(() => {
      aggregate = new CustomerAggregate()
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
