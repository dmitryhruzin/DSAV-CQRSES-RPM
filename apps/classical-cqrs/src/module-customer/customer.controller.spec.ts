import { jest } from '@jest/globals'
import { CustomerController } from './customer.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { CreateCustomerCommand } from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'

describe('UserController', () => {
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
        payload: { userID: 'user1', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expected: new CreateCustomerCommand({ userID: 'user1', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' })
      },
      {
        description: 'should throw a validation error if userID is empty',
        payload: { userID: '', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expectedError: 'User ID must be a non-empty string'
      },
      {
        description: 'should throw a validation error if firstName is empty',
        payload: { userID: 'user1', firstName: '', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
        expectedError: 'First name must be a non-empty string'
      },
      {
        description: 'should throw a validation error if lastName is empty',
        payload: { userID: 'user1', firstName: 'John', lastName: '', email: 'john.doe@example.com', phoneNumber: '+1234567890' },
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
})
