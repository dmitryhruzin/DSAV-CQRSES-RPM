import { jest } from '@jest/globals'
import { UserController } from './user.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import {
  CreateUserCommand,
  ChangeUserPasswordCommand,
  UserEnterSystemCommand,
  UserExitSystemCommand
} from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'
import { GetUserMainByIdQuery, ListUsersMainQuery } from './queries/index.js'

describe('UserController', () => {
  describe('create', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new UserController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute CreateUserCommand',
        payload: { password: '12345678' },
        expected: new CreateUserCommand({ password: '12345678' })
      },
      {
        description: 'should throw a validation error',
        payload: { password: '' },
        expectedError: 'Password must be a non-empty string'
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

  describe('changePassword', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new UserController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ChangeUserPasswordCommand',
        payload: { id: '1', newPassword: '12345678' },
        expected: new ChangeUserPasswordCommand({ id: '1', newPassword: '12345678' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', newPassword: '12345678' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw a password validation error',
        payload: { id: '1', newPassword: '' },
        expectedError: 'Password must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.changePassword(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.changePassword(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('enterSystem', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new UserController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute UserEnterSystemCommand',
        payload: { id: '1' },
        expected: new UserEnterSystemCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.enterSystem(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.enterSystem(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('exitSystem', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new UserController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute UserExitSystemCommand',
        payload: { id: '1' },
        expected: new UserExitSystemCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.exitSystem(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.enterSystem(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('getUsersMain', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new UserController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with GetUsersMain query',
        expected: new ListUsersMainQuery(1, 10),
        page: 1,
        pageSize: 10
      }
    ]
    test.each(testCases)('$description', async ({ expected, page, pageSize }) => {
      await controller.listUsersMain(page, pageSize)
      expect(queryBus.execute).toHaveBeenCalledWith(expected)
    })
  })

  describe('getUserMainById', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new UserController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with GetUserMainById query',
        id: '1',
        expected: new GetUserMainByIdQuery('1')
      },
      {
        description: 'should throw a validation error',
        id: '',
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected, expectedError }) => {
      try {
        await controller.getUserMainById(id)
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
