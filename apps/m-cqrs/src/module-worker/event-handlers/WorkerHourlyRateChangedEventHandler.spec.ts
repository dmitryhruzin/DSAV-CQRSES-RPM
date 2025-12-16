import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerHourlyRateChangedV1 } from '../events/index.js'
import { WorkerHourlyRateChangedEventHandler } from './WorkerHourlyRateChangedEventHandler.js'

describe('WorkerHourlyRateChangedEventHandler', () => {
  describe('handle', () => {
    let repository: WorkerMainProjection
    let handler: WorkerHourlyRateChangedEventHandler

    beforeEach(() => {
      repository = new WorkerMainProjection({} as knex.Knex, {} as Logger)
      repository.update = jest.fn() as jest.Mocked<typeof repository.update>
      handler = new WorkerHourlyRateChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with WorkerHourlyRateChangedV1 event',
        payload: new WorkerHourlyRateChangedV1({
          previousHourlyRate: '15.00',
          hourlyRate: '20.00',
          aggregateId: '1234',
          aggregateVersion: 1
        }),
        expectedId: '1234',
        expectedPayload: { hourlyRate: '20.00', version: 1 }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.update).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
