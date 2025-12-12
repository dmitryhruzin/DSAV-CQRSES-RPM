import { jest } from '@jest/globals'
import { CustomerController } from './customer.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ChangeCustomerContactsCommand, CreateCustomerCommand, DeleteCustomerCommand, RenameCustomerCommand } from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'
import { GetCustomerMainByIdQuery, ListCustomersMainQuery } from './queries/index.js'

describe('CustomerController', () => {
  describe('create', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CustomerController(commandBus, {} as QueryBus)
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute CreateCustomerCommand',
        payload: { userID: '1', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expected: new CreateCustomerCommand({ userID: '1', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' })
      },
      {
        description: 'should throw a validation error if userID is empty',
        payload: { userID: '', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expectedError: 'User ID must be a non-empty string'
      },
      {
        description: 'should throw a validation error if firstName is empty',
        payload: { userID: '1', firstName: '', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expectedError: 'First name must be a non-empty string'
      },
      {
        description: 'should throw a validation error if lastName is empty',
        payload: { userID: '1', firstName: 'John', lastName: '', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expectedError: 'Last name must be a non-empty string'
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
  
  describe('rename', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CustomerController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute RenameCustomerCommand',
        payload: { id: '1', firstName: 'Jane', lastName: 'Smith' },
        expected: new RenameCustomerCommand({ id: '1', firstName: 'Jane', lastName: 'Smith' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', firstName: 'Jane', lastName: 'Smith' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw a firstName validation error',
        payload: { id: '1', firstName: '', lastName: 'Smith' },
        expectedError: 'First name must be a non-empty string'
      },
      {
        description: 'should throw a lastName validation error',
        payload: { id: '1', firstName: 'Jane', lastName: '' },
        expectedError: 'Last name must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.rename(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.rename(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })
  
  describe('changeContacts', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CustomerController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ChangeCustomerContactsCommand',
        payload: { id: '1', email: 'jane.smith@example.com', phoneNumber: '+1234567890' },
        expected: new ChangeCustomerContactsCommand({ id: '1', email: 'jane.smith@example.com', phoneNumber: '+1234567890' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', email: 'jane.smith@example.com', phoneNumber: '+1234567890' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw an email validation error',
        payload: { id: '1', email: '', phoneNumber: '+1234567890' },
        expectedError: 'Email must be a non-empty string'
      },
      {
        description: 'should throw a phoneNumber validation error',
        payload: { id: '1', email: 'jane.smith@example.com', phoneNumber: '' },
        expectedError: 'Phone number must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.changeContacts(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.changeContacts(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })
  
  describe('delete', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CustomerController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute DeleteCustomerCommand',
        payload: { id: '1' },
        expected: new DeleteCustomerCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'Customer ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.delete(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.delete(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('listCustomersMain', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new CustomerController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with ListCustomersMain query',
        expected: new ListCustomersMainQuery(1, 10),
        page: 1,
        pageSize: 10
      }
    ]
    test.each(testCases)('$description', async ({ expected, page, pageSize }) => {
      await controller.listCustomersMain(page, pageSize)
      expect(queryBus.execute).toHaveBeenCalledWith(expected)
    })
  })

  describe('getCustomerMainById', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new CustomerController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with GetCustomerMainById query',
        id: '1',
        expected: new GetCustomerMainByIdQuery('1')
      },
      {
        description: 'should throw a validation error',
        id: '',
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected, expectedError }) => {
      try {
        await controller.getCustomerMainById(id)
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
