import { jest } from '@jest/globals'
import { WorkerController } from './worker.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import {
  ChangeWorkerHourlyRateCommand,
  ChangeWorkerRoleCommand,
  DismissWorkerCommand,
  HireWorkerCommand
} from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'
import { GetWorkerMainByIdQuery, ListWorkersMainQuery } from './queries/index.js'

describe('WorkerController', () => {
  describe('hire', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new WorkerController(commandBus, {} as QueryBus)
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute HireWorkerCommand',
        payload: { hourlyRate: '20.00', role: 'manager' },
        expected: new HireWorkerCommand({ hourlyRate: '20.00', role: 'manager' })
      },
      {
        description: 'should throw a validation error if hourlyRate is empty',
        payload: { hourlyRate: '', role: 'manager' },
        expectedError: 'Hourly rate must be a non-empty string'
      },
      {
        description: 'should throw a validation error if role is empty',
        payload: { hourlyRate: '20.00', role: '' },
        expectedError: 'Role must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.hire(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.hire(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('changeRole', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new WorkerController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ChangeWorkerRoleCommand',
        payload: { id: '1', role: 'washer' },
        expected: new ChangeWorkerRoleCommand({
          id: '1',
          role: 'washer'
        })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', role: 'washer' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw a role validation error',
        payload: { id: '1', role: '' },
        expectedError: 'Role must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.changeRole(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.changeRole(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('changeHourlyRate', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new WorkerController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ChangeWorkerHourlyRateCommand',
        payload: { id: '1', hourlyRate: '20.00' },
        expected: new ChangeWorkerHourlyRateCommand({ id: '1', hourlyRate: '20.00' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', hourlyRate: '20.00' },
        expectedError: 'ID must be a non-empty string'
      },
      {
        description: 'should throw a hourlyRate validation error',
        payload: { id: '1', hourlyRate: '' },
        expectedError: 'Hourly rate must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.changeHourlyRate(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.changeHourlyRate(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('dismiss', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new WorkerController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute DismissWorkerCommand',
        payload: { id: '1' },
        expected: new DismissWorkerCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.dismiss(payload.id)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.dismiss(payload.id)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('listWorkersMain', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new WorkerController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with ListWorkersMain query',
        expected: new ListWorkersMainQuery(1, 10),
        page: 1,
        pageSize: 10
      }
    ]
    test.each(testCases)('$description', async ({ expected, page, pageSize }) => {
      await controller.listWorkersMain(page, pageSize)
      expect(queryBus.execute).toHaveBeenCalledWith(expected)
    })
  })

  describe('getWorkerMainById', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new WorkerController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with GetWorkerMainById query',
        id: '1',
        expected: new GetWorkerMainByIdQuery('1')
      },
      {
        description: 'should throw a validation error',
        id: '',
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected, expectedError }) => {
      try {
        await controller.getWorkerMainById(id)
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
