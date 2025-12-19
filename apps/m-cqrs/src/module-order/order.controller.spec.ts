import { jest } from '@jest/globals'
import { OrderController } from './order.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import {
  CreateOrderCommand,
  ApproveOrderCommand,
  StartOrderCommand,
  CancelOrderCommand,
  ChangeOrderPriceCommand,
  ApplyDiscountToOrderCommand,
  SetOrderPriorityCommand
} from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'
import { CompleteOrderCommand } from './commands/CompleteOrderCommand.js'
import { GetOrderMainByIdQuery, ListOrdersMainQuery } from './queries/index.js'

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

  describe('complete', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute CompleteOrderCommand',
        payload: { id: '1' },
        expected: new CompleteOrderCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.complete(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.complete(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('cancel', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute CancelOrderCommand',
        payload: { id: '1' },
        expected: new CancelOrderCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.cancel(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.cancel(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('changePrice', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ChangeOrderPriceCommand',
        payload: { id: '1', price: '150.00' },
        expected: new ChangeOrderPriceCommand({ id: '1', price: '150.00' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', price: '150.00' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw an price validation error',
        payload: { id: '1', price: '' },
        expectedError: 'Price must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.changePrice(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.changePrice(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('applyDiscount', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ApplyDiscountToOrderCommand',
        payload: { id: '1', discount: '10.00' },
        expected: new ApplyDiscountToOrderCommand({ id: '1', discount: '10.00' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', discount: '10.00' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw an discount validation error',
        payload: { id: '1', discount: '' },
        expectedError: 'Discount must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.applyDiscount(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.applyDiscount(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('setPriority', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new OrderController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute SetPriorityCommand',
        payload: { id: '1', priority: 1 },
        expected: new SetOrderPriorityCommand({ id: '1', priority: 1 })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', priority: 1 },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw an priority validation error',
        payload: { id: '1', priority: Number.NaN },
        expectedError: 'Priority must be provided'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.setPriority(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.setPriority(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('listOrdersMain', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new OrderController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with ListOrdersMain query',
        expected: new ListOrdersMainQuery(1, 10),
        page: 1,
        pageSize: 10
      }
    ]
    test.each(testCases)('$description', async ({ expected, page, pageSize }) => {
      await controller.listOrdersMain(page, pageSize)
      expect(queryBus.execute).toHaveBeenCalledWith(expected)
    })
  })

  describe('getOrderMainById', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new OrderController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with GetOrderMainById query',
        id: '1',
        expected: new GetOrderMainByIdQuery('1')
      },
      {
        description: 'should throw a validation error',
        id: '',
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected, expectedError }) => {
      try {
        await controller.getOrderMainById(id)
        expect(queryBus.execute).toHaveBeenCalledWith(expected)

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
})
