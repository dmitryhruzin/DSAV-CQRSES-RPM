import { jest } from '@jest/globals'
import { CarCreatedEventHandler } from './CarCreatedEventHandler.js'
import { CarMainProjection } from '../projections/car-main.projection.js'
import knex from 'knex'
import { CarCreatedV1 } from '../events/index.js'
import { Logger } from '@DSAV-CQRSES-RPM/logger'

describe('CarCreatedEventHandler', () => {
  describe('handle', () => {
    let repository: CarMainProjection
    let handler: CarCreatedEventHandler

    beforeEach(() => {
      repository = new CarMainProjection({} as knex.Knex, {} as Logger)
      repository.save = jest.fn() as jest.Mocked<typeof repository.save>
      handler = new CarCreatedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with specific event',
        payload: new CarCreatedV1({
          id: '1',
          aggregateId: '1234',
          aggregateVersion: 1,
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'ABC123',
          mileage: 10000
        }),
        expected: {
          id: '1',
          version: 1,
          ownerID: '1',
          vin: '1HGCM82633A123456',
          registrationNumber: 'ABC123',
          mileage: 10000
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expected }) => {
      await handler.handle(payload)

      expect(repository.save).toHaveBeenCalledWith(expected)
    })
  })
})
