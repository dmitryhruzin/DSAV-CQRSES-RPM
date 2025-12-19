import { jest } from '@jest/globals'
import { OrderController } from './order.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { CreateOrderCommand, ApproveOrderCommand, StartOrderCommand } from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'
// import { GetWorkerMainByIdQuery, ListWorkersMainQuery } from './queries/index.js'

describe('OrderController', () => {
  describe('hire', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute CreateOrderCommand',
        payload: { title: 'Test Order', price: '100.00', discount: '10.00', priority: 1 },
        expected: new CreateOrderCommand({ title: 'Test Order', price: '100.00', discount: '10.00', priority: 1 })
      },
      {
        description: 'should throw a validation error if title is empty',
        payload: { title: '', price: '100.00', discount: '10.00', priority: 1 },
        expectedError: 'Title must be a non-empty string'
      },
      {
        description: 'should throw a validation error if price is empty',
        payload: { title: 'Test Order', price: '', discount: '10.00', priority: 1 },
        expectedError: 'Price must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.create(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.create(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('approve', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ApproveOrderCommand',
        payload: { id: '1' },
        expected: new ApproveOrderCommand({
          id: '1'
        })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.approve(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.approve(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('start', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute StartOrderCommand',
        payload: { id: '1' },
        expected: new StartOrderCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.start(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.start(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  // describe('dismiss', () => {
  //   const commandBus = new CommandBus({} as ModuleRef)
  //   commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
  //   const controller = new WorkerController(commandBus, {} as QueryBus)

  //   beforeEach(() => {
  //     jest.clearAllMocks()
  //   })

  //   const testCases = [
  //     {
  //       description: 'should execute DismissWorkerCommand',
  //       payload: { id: '1' },
  //       expected: new DismissWorkerCommand({ id: '1' })
  //     },
  //     {
  //       description: 'should throw an ID validation error',
  //       payload: { id: '' },
  //       expectedError: 'ID must be a non-empty string'
  //     }
  //   ]
  //   test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
  //     if (expectedError) {
  //       await expect(controller.dismiss(payload.id)).rejects.toThrow(expectedError)
  //       expect(commandBus.execute).not.toHaveBeenCalled()
  //     }
  //     if (expected) {
  //       await controller.dismiss(payload.id)
  //       expect(commandBus.execute).toHaveBeenCalledWith(expected)
  //     }
  //   })
  // })

  // describe('listWorkersMain', () => {
  //   const queryBus = new QueryBus({} as ModuleRef)
  //   queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
  //   const controller = new WorkerController({} as CommandBus, queryBus)

  //   const testCases = [
  //     {
  //       description: 'should call query bus with ListWorkersMain query',
  //       expected: new ListWorkersMainQuery(1, 10),
  //       page: 1,
  //       pageSize: 10
  //     }
  //   ]
  //   test.each(testCases)('$description', async ({ expected, page, pageSize }) => {
  //     await controller.listWorkersMain(page, pageSize)
  //     expect(queryBus.execute).toHaveBeenCalledWith(expected)
  //   })
  // })

  // describe('getWorkerMainById', () => {
  //   const queryBus = new QueryBus({} as ModuleRef)
  //   queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
  //   const controller = new WorkerController({} as CommandBus, queryBus)

  //   const testCases = [
  //     {
  //       description: 'should call query bus with GetWorkerMainById query',
  //       id: '1',
  //       expected: new GetWorkerMainByIdQuery('1')
  //     },
  //     {
  //       description: 'should throw a validation error',
  //       id: '',
  //       expectedError: 'ID must be a non-empty string'
  //     }
  //   ]
  //   test.each(testCases)('$description', async ({ id, expected, expectedError }) => {
  //     try {
  //       await controller.getWorkerMainById(id)
  //       expect(queryBus.execute).toHaveBeenCalledWith(expected)

  //       if (expectedError) {
  //         expect(true).toBeFalsy()
  //       }
  //     } catch (err) {
  //       if (!expectedError) {
  //         throw err
  //       }
  //       expect((err as Error).message).toEqual(expectedError)
  //     }
  //   })
  // })
})
