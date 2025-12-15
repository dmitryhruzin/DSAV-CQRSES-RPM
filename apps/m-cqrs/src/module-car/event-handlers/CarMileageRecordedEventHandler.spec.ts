import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { CarMileageRecordedV1 } from '../events/index.js'
import { CarMileageRecordedEventHandler } from './CarMileageRecordedEventHandler.js'

describe('CarMileageRecordedEventHandler', () => {
  describe('handle', () => {
    let repository: CarMainProjection
    let handler: CarMileageRecordedEventHandler

    beforeEach(() => {
      repository = new CarMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new CarMileageRecordedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with CarMileageRecordedV1 event',
        payload: new CarMileageRecordedV1({
          previousMileage: 5000,
          mileage: 7500,
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { mileage: 7500, version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
