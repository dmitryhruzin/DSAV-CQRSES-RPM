import { jest } from '@jest/globals'
import { WorkAggregate } from './work.aggregate.js'
import {
  AddWorkToOrderCommand,
  AssignWorkToWorkerCommand,
  ChangeWorkDescriptionCommand,
  ChangeWorkTitleCommand,
  CreateWorkCommand
} from './commands/index.js'
import { STATUS } from '../constants/work.js'
import { WorkAddedToOrderV1, WorkAssignedToWorkerV1, WorkStatusChangedV1 } from './events/index.js'

describe('WorkAggregate', () => {
  describe('toJson', () => {
    const testCases = [
      {
        description: 'should return a js Object',
        getAggregate: () => {
          const aggregate = new WorkAggregate()
          aggregate.create(
            new CreateWorkCommand({
              title: 'Test Work',
              description: 'This is a test work'
            })
          )
          return aggregate
        },
        expected: { title: 'Test Work', description: 'This is a test work' }
      },
      {
        description: 'should return an error for empty aggregate',
        getAggregate: () => new WorkAggregate(),
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
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should not create if title is not valid',
        payload: {
          title: 'Th', // invalid title
          description: 'This is a test work'
        },
        expectedError: 'Invalid title'
      },
      {
        description: 'should not create if description is not valid',
        payload: {
          title: 'Test Work',
          description: '  ' // invalid description
        },
        expectedError: 'Invalid description'
      },
      {
        description: 'should create new aggregate with new ID',
        payload: {
          title: 'Test Work',
          description: 'This is a test work'
        },
        expected: {
          title: 'Test Work',
          description: 'This is a test work'
        }
      },
      {
        description: 'should build an aggregate using existing event',
        payload: {
          id: '1',
          title: 'Test Work',
          description: 'This is a test work'
        },
        expected: {
          id: '1',
          title: 'Test Work',
          description: 'This is a test work'
        }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.create(new CreateWorkCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.create(new CreateWorkCommand(payload))

        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().title).toEqual(expected.title)
        expect(result[0].toJson().description).toEqual(expected.description)
      }
    })
  })

  describe('changeTitle', () => {
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should change title for existing aggregate',
        payload: { id: '1', title: 'New Title' },
        expected: { title: 'New Title' }
      },
      {
        description: 'should not change title if title is not valid',
        payload: { id: '1', title: '  ' },
        expectedError: 'Invalid title'
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.changeTitle(new ChangeWorkTitleCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const command = new ChangeWorkTitleCommand(payload)

        const result = aggregate.changeTitle(command)
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().title).toEqual(expected.title)
      }
    })
  })

  describe('changeDescription', () => {
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should update description for existing aggregate',
        payload: { id: '1', description: 'New Description' },
        expected: { description: 'New Description' }
      },
      {
        description: 'should not change description if description is not valid',
        payload: { id: '1', description: '  ' },
        expectedError: 'Invalid description'
      }
    ]
    test.each(testCases)('$description', ({ payload, expected, expectedError }) => {
      if (expectedError) {
        expect(() => {
          aggregate.changeDescription(new ChangeWorkDescriptionCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const command = new ChangeWorkDescriptionCommand(payload)

        const result = aggregate.changeDescription(command)
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().description).toEqual(expected.description)
      }
    })
  })

  describe('start', () => {
    let aggregate: WorkAggregate

    const testCases = [
      {
        description: 'should update aggregate status to in progress for existing aggregate',
        expected: { status: STATUS.IN_PROGRESS }
      },
      {
        description: 'should not change status if status is not valid',
        started: true,
        expectedError: 'Work can be started only from TODO status'
      }
    ]
    test.each(testCases)('$description', ({ started, expected, expectedError }) => {
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status: started ? STATUS.IN_PROGRESS : STATUS.TODO
      })
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

  describe('pause', () => {
    let aggregate: WorkAggregate

    const testCases = [
      {
        description: 'should update aggregate status to in progress for existing aggregate',
        started: true,
        expected: { status: STATUS.PAUSED }
      },
      {
        description: 'should not change status if status is not valid',
        started: false,
        expectedError: 'Work can be paused only if it is in IN_PROGRESS status'
      }
    ]
    test.each(testCases)('$description', ({ started, expected, expectedError }) => {
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status: started ? STATUS.IN_PROGRESS : STATUS.TODO
      })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.pause()
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.pause()
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().status).toEqual(expected.status)
      }
    })
  })

  describe('resume', () => {
    let aggregate: WorkAggregate

    const testCases = [
      {
        description: 'should update aggregate status to in progress for existing aggregate',
        paused: true,
        expected: { status: STATUS.IN_PROGRESS }
      },
      {
        description: 'should not change status if status is not valid',
        paused: false,
        expectedError: 'Work can be resumed only if it is in PAUSED status'
      }
    ]
    test.each(testCases)('$description', ({ paused, expected, expectedError }) => {
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status: paused ? STATUS.PAUSED : STATUS.TODO
      })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.resume()
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.resume()
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().status).toEqual(expected.status)
      }
    })
  })

  describe('complete', () => {
    let aggregate: WorkAggregate

    const testCases = [
      {
        description: 'should update aggregate status to in progress for existing aggregate',
        started: true,
        expected: { status: STATUS.COMPLETED }
      },
      {
        description: 'should not change status if status is not valid',
        started: false,
        expectedError: 'Work can be completed only if it is in IN_PROGRESS status'
      }
    ]
    test.each(testCases)('$description', ({ started, expected, expectedError }) => {
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status: started ? STATUS.IN_PROGRESS : STATUS.TODO
      })
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
    let aggregate: WorkAggregate

    const testCases = [
      {
        description: 'should update aggregate status to in progress for existing aggregate',
        started: true,
        expected: { status: STATUS.CANCELLED }
      },
      {
        description: 'should not change status if status is not valid',
        canceled: true,
        expectedError: 'Work is already cancelled'
      }
    ]
    test.each(testCases)('$description', ({ started, canceled, expected, expectedError }) => {
      let status: string = STATUS.TODO
      if (canceled) status = STATUS.CANCELLED
      if (started) status = STATUS.IN_PROGRESS
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status
      })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.cancel()
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.cancel()
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().status).toEqual(expected.status)
      }
    })
  })

  describe('assignToWorker', () => {
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should update assigned worker for existing aggregate',
        started: false,
        payload: { id: '1', workerID: 'worker-123' },
        expected: { assignedTo: 'worker-123' }
      },
      {
        description: 'should not change assigned worker if work status is not valid',
        started: true,
        payload: { id: '1', workerID: 'worker-123' },
        expectedError: 'Work can be assigned only if it is in TODO status'
      }
    ]
    test.each(testCases)('$description', ({ started, payload, expected, expectedError }) => {
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status: started ? STATUS.IN_PROGRESS : STATUS.TODO
      })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.assignToWorker(new AssignWorkToWorkerCommand(payload))
        }).toThrow(expectedError)
      } else if (expected) {
        const command = new AssignWorkToWorkerCommand(payload)

        const result = aggregate.assignToWorker(command)
        expect(aggregate.apply).toHaveBeenCalledTimes(2)
        expect((result[0] as WorkAssignedToWorkerV1).toJson().workerID).toEqual(expected.assignedTo)
      }
    })
  })

  describe('unassignFromWorker', () => {
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should unassign worker for work with status TODO',
        started: false,
        assignedTo: 'worker-123',
        expectedEventsLength: 2
      },
      {
        description: 'should unassign worker for existing aggregate',
        started: true,
        assignedTo: 'worker-123',
        expectedEventsLength: 3
      },
      {
        description: 'should throw an error if worker is not assigned',
        started: false,
        assignedTo: undefined,
        expectedError: 'Work is not assigned to any worker'
      }
    ]
    test.each(testCases)('$description', ({ started, assignedTo, expectedEventsLength, expectedError }) => {
      aggregate = new WorkAggregate({ 
        id: '1',
        version: 1,
        title: 'Test Work',
        description: 'This is a test work',
        status: started ? STATUS.IN_PROGRESS : STATUS.TODO,
        assignedTo
      })
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.unassignFromWorker()
        }).toThrow(expectedError)
      } else if (expectedEventsLength) {
        const result = aggregate.unassignFromWorker()
        expect(aggregate.apply).toHaveBeenCalledTimes(expectedEventsLength)
        expect(result.length).toEqual(expectedEventsLength)
      }
    })
  })

  describe('addToOrder', () => {
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should change order for existing aggregate',
        payload: { id: '1', orderID: 'order-123' },
        expected: { orderID: 'order-123' }
      }
    ]
    test.each(testCases)('$description', ({ payload, expected }) => {
      const command = new AddWorkToOrderCommand(payload)

      const result = aggregate.addToOrder(command)
      expect(aggregate.apply).toHaveBeenCalledTimes(1)
      expect(result[0].toJson().orderID).toEqual(expected.orderID)
    })
  })

  describe('removeFromOrder', () => {
    let aggregate: WorkAggregate

    beforeEach(() => {
      aggregate = new WorkAggregate()
      aggregate.apply = jest.fn()
    })

    const testCases = [
      {
        description: 'should remove order for existing aggregate',
        payload: { id: '1' },
        order: 'order-123',
        expected: { orderID: 'order-123' }
      },
      {
        description: 'should not remove order if orderID is not set',
        payload: { id: '1' },
        expectedError: 'Work is not added to any order'
      }
    ]
    test.each(testCases)('$description', ({ payload, order, expected, expectedError }) => {
      aggregate = new WorkAggregate()
      if (order) {
        aggregate.addToOrder(new AddWorkToOrderCommand({ id: payload.id, orderID: order }))
      }
      aggregate.apply = jest.fn()

      if (expectedError) {
        expect(() => {
          aggregate.removeFromOrder()
        }).toThrow(expectedError)
      } else if (expected) {
        const result = aggregate.removeFromOrder()
        expect(aggregate.apply).toHaveBeenCalledTimes(1)
        expect(result[0].toJson().previousOrderID).toEqual(expected.orderID)
      }
    })
  })
})
