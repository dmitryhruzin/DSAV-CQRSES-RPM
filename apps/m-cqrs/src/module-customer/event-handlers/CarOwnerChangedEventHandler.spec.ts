import { jest } from '@jest/globals'
import knex from 'knex'
import { Logger } from '@DSAV-CQRSES-RPM/logger'
import { CarOwnerChangedEventHandler } from './CarOwnerChangedEventHandler.js'
import { CustomerWithCarsProjection } from '../projections/index.js'
import { CarOwnerChangedV1 } from '../../module-car/events/index.js'

describe('CarOwnerChangedEventHandler', () => {
  describe('handle', () => {
    let repository: CustomerWithCarsProjection
    let handler: CarOwnerChangedEventHandler

    beforeEach(() => {
      repository = new CustomerWithCarsProjection({} as knex.Knex, {} as Logger)
      repository.updateCar = jest.fn() as jest.Mocked<typeof repository.updateCar>
      handler = new CarOwnerChangedEventHandler(repository)
    })

    const testCases = [
      {
        description: 'should call repository with CarOwnerChangedV1 event',
        payload: new CarOwnerChangedV1({
          previousOwnerID: 'oldOwnerID',
          ownerID: 'newOwnerID',
          aggregateId: '1234',
          aggregateVersion: 1,
          owner: { id: 'newOwnerID', version: 1, userID: 'user2', firstName: 'Jane', lastName: 'Smith' }
        }),
        expectedId: '1234',
        expectedPayload: {
          customerID: 'newOwnerID',
          userID: 'user2',
          firstName: 'Jane',
          lastName: 'Smith',
          customerVersion: 1,
          carVersion: 1
        }
      }
    ]
    test.each(testCases)('$description', async ({ payload, expectedId, expectedPayload }) => {
      await handler.handle(payload)

      expect(repository.updateCar).toHaveBeenCalledWith(expectedId, expectedPayload)
    })
  })
})
