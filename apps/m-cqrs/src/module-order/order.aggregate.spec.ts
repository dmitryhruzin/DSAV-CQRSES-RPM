import { jest } from '@jest/globals'
import { OrderAggregate } from './order.aggregate.js'
import { CreateOrderCommand } from './commands/index.js'
import { STATUS } from '../constants/order.js'

describe('OrderAggregate', () => {
  describe('toJson', () => {
    const testCases = [
      {
        description: 'should return a js Object',
        getAggregate: () => {
          const aggregate = new OrderAggregate()
          aggregate.create(
            new CreateOrderCommand({
              title: 'Sample Order',
              price: '15.00',
              discount: '0.00',
              priority: 1
            })
          )
          return aggregate
        },
        expected: {
          price: '15.00',
          title: 'Sample Order',
          discount: '0.00',
          priority: 1,
          status: STATUS.TODO,
          approved: false
        }
      },
      {
        description: 'should return an error for empty aggregate',
        getAggregate: () => new OrderAggregate(),
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
    let aggregate: OrderAggregate

    beforeEach(() => {
      aggregate = new OrderAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should not create if title is not valid',
        payload: {
          title: '  Sample Order. ',
          price: '15.00',
          discount: '50.00',
          priority: 1
        },
        expectedError: 'Invalid title'
      },
      {
        description: 'should not create if price is not valid',
        payload: {
          title: 'Sample Order',
          price: 'invalid price',
          discount: '50.00',
          priority: 1
        },
        expectedError: 'Invalid price'
      },
      {
        description: 'should create new aggregate with new ID',
        payload: {
          title: 'Sample Order',
          price: '15.00',
          discount: '50.00',
          priority: 1
        },
        expected: {
          title: 'Sample Order',
          price: '15.00',
          discount: '50.00',
          priority: 1
        }
      },
      {
        description: 'should build an aggregate using existing event',
        payload: {
          id: '1',
          title: 'Sample Order',
          price: '15.00',
          discount: '50.00',
          priority: 1
        },
        expected: {
          id: '1',
          title: 'Sample Order',
          price: '15.00',
          discount: '50.00',
          priority: 1
        }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.create(new CreateOrderCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.create(new CreateOrderCommand(payload))

        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().price).toEqual(expected.price)
        expect(result[0].toJson().title).toEqual(expected.title)
      }
    })
  })

  describe('approve', () => {
    let aggregate: OrderAggregate

    beforeEach(() => {
      aggregate = new OrderAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should set approved to true for existing aggregate',
        payload: { id: '1' },
        expected: { version: 1 }
      }
    ]
    test.each(testCases)('$description', ({ expected }) => {
      const result = aggregate.approve()
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].aggregateVersion).toEqual(expected.version)
    })
  })

  describe('start', () => {
    let aggregate: OrderAggregate

    const testCases = [
      {
        description: 'should update aggregate status to in progress for existing aggregate',
        state: { approved: true, status: STATUS.TODO },
        expected: { status: STATUS.IN_PROGRESS }
      },
      {
        description: 'should not change status if status is not valid',
        state: { approved: true, status: STATUS.IN_PROGRESS },
        expectedError: 'Order with status other than TODO cannot be started'
      },
      {
        description: 'should not change status if aggregate is not approved',
        state: { approved: false, status: STATUS.TODO },
        expectedError: 'Only approved orders can be started'
      }
    ]
    test.each(testCases)('$description', ({ state, expected, expectedError }) => {
      aggregate = new OrderAggregate({ id: '1', version: 2, title: 'Sample Order', price: '15.00', ...state })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.start()
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.start()
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().status).toEqual(expected.status)
      }
    })
  })

  describe('complete', () => {
    let aggregate: OrderAggregate

    const testCases = [
      {
        description: 'should update aggregate status to completed for existing aggregate',
        state: { status: STATUS.IN_PROGRESS },
        expected: { status: STATUS.COMPLETED }
      },
      {
        description: 'should not change status if status is not valid',
        state: { status: STATUS.TODO },
        expectedError: 'Order with status other than IN_PROGRESS cannot be completed'
      }
    ]
    test.each(testCases)('$description', ({ state, expected, expectedError }) => {
      aggregate = new OrderAggregate({ id: '1', version: 2, title: 'Sample Order', price: '15.00', approved: true, ...state })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.complete()
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.complete()
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().status).toEqual(expected.status)
      }
    })
  })

  describe('cancel', () => {
    let aggregate: OrderAggregate

    const testCases = [
      {
        description: 'should update aggregate status to cancelled for existing aggregate',
        state: { status: STATUS.IN_PROGRESS },
        expected: { status: STATUS.CANCELLED }
      }
    ]
    test.each(testCases)('$description', ({ state, expected }) => {
      aggregate = new OrderAggregate({ id: '1', version: 2, title: 'Sample Order', price: '15.00', approved: true, ...state })
      aggregate.apply = jest.fn()

      const result = aggregate.cancel()
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().status).toEqual(expected.status)
    })
  })
})
