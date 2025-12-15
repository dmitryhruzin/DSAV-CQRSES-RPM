import { jest } from '@jest/globals'
import { CarController } from './car.controller.js'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ChangeCarOwnerCommand, CreateCarCommand, DeleteCarCommand, RecordCarMileageCommand } from './commands/index.js'
import { ModuleRef } from '@nestjs/core/injector/module-ref.js'
import { GetCarMainByIdQuery, ListCarsMainQuery } from './queries/index.js'

describe('CarController', () => {
  describe('create', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CarController(commandBus, {} as QueryBus)
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute CreateCarCommand',
        payload: {
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        },
        expected: new CreateCarCommand({
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        })
      },
      {
        description: 'should throw a validation error if ownerID is empty',
        payload: {
          ownerID: '',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        },
        expectedError: 'Owner ID must be a non-empty string'
      },
      {
        description: 'should throw a validation error if vin is empty',
        payload: {
          ownerID: '1',
          vin: '',
          registrationNumber: 'AB1231AA',
          mileage: 10000
        },
        expectedError: 'VIN must be a non-empty string'
      },
      {
        description: 'should throw a validation error if registrationNumber is empty',
        payload: {
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: '',
          mileage: 10000
        },
        expectedError: 'Registration number must be a non-empty string'
      },
      {
        description: 'should throw a validation error if mileage is empty',
        payload: {
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'AB1231AA',
          mileage: NaN
        },
        expectedError: 'Mileage must be a number'
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

  describe('recordMileage', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CarController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute RecordCarMileageCommand',
        payload: { id: '1', mileage: 15000 },
        expected: new RecordCarMileageCommand({ id: '1', mileage: 15000 })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', mileage: 15000 },
        expectedError: 'Car ID must be a non-empty string'
      },
      {
        description: 'should throw a mileage validation error',
        payload: { id: '1', mileage: NaN },
        expectedError: 'Mileage must be a number'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.recordMileage(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.recordMileage(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('changeOwner', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CarController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute ChangeCarOwnerCommand',
        payload: { id: '1', ownerID: '2' },
        expected: new ChangeCarOwnerCommand({
          id: '1',
          ownerID: '2'
        })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '', ownerID: '2' },
        expectedError: 'Car ID must be a non-empty string'
      },
      {
        description: 'should throw an ownerID validation error',
        payload: { id: '1', ownerID: '' },
        expectedError: 'Owner ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected, expectedError }) => {
      if (expectedError) {
        await expect(controller.changeOwner(payload)).rejects.toThrow(expectedError)
        expect(commandBus.execute).not.toHaveBeenCalled()
      }
      if (expected) {
        await controller.changeOwner(payload)
        expect(commandBus.execute).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('delete', () => {
    const commandBus = new CommandBus({} as ModuleRef)
    commandBus.execute = jest.fn() as jest.Mocked<typeof commandBus.execute>
    const controller = new CarController(commandBus, {} as QueryBus)

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const testCases = [
      {
        description: 'should execute DeleteCarCommand',
        payload: { id: '1' },
        expected: new DeleteCarCommand({ id: '1' })
      },
      {
        description: 'should throw an ID validation error',
        payload: { id: '' },
        expectedError: 'Car ID must be a non-empty string'
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

  describe('listCarsMain', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new CarController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with ListCarsMain query',
        expected: new ListCarsMainQuery(1, 10),
        page: 1,
        pageSize: 10
      }
    ]
    test.each(testCases)('$description', async ({ expected, page, pageSize }) => {
      await controller.listCarsMain(page, pageSize)
      expect(queryBus.execute).toHaveBeenCalledWith(expected)
    })
  })

  describe('getCarMainById', () => {
    const queryBus = new QueryBus({} as ModuleRef)
    queryBus.execute = jest.fn() as unknown as jest.Mocked<typeof queryBus.execute>
    const controller = new CarController({} as CommandBus, queryBus)

    const testCases = [
      {
        description: 'should call query bus with GetCarMainById query',
        id: '1',
        expected: new GetCarMainByIdQuery('1')
      },
      {
        description: 'should throw a validation error',
        id: '',
        expectedError: 'ID must be a non-empty string'
      }
    ]
    test.each(testCases)('$description', async ({ id, expected, expectedError }) => {
      try {
        await controller.getCarMainById(id)
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
