import { jest } from '@jest/globals'
import { UserAggregate } from './user.aggregate.js'
import { CreateUserCommand } from './commands/CreateUserCommand.js'

describe('UserAggregate', () => {
  describe('toJson', () => {
    const testCases = [
      {
        description: 'should return a js Object',
        getAggregate: () => {
          const aggregate = new UserAggregate()
          const [event] = aggregate.create(new CreateUserCommand({ password: '12345678' }))
          aggregate.replayUserCreatedV1(event)
          return aggregate
        },
        expected: { password: '12345678' }
      },
      {
        description: 'should return an error for empty aggregate',
        getAggregate: () => new UserAggregate(),
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
    let aggregate: UserAggregate

    beforeEach(() => {
      aggregate = new UserAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should create new aggregate with new ID',
        payload: { password: 'John Doe' },
        expected: { password: 'John Doe' }
      },
      {
        description: 'should build an aggregate using existing event',
        payload: { id: '1', password: 'John Doe' },
        expected: { id: '1', password: 'John Doe' }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected }) => {
      const result = aggregate.create(new CreateUserCommand(payload))

      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().password).toEqual(expected.password)
    })
  })
})
