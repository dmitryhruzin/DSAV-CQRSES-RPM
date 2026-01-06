import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CarCreatedV1 } from '../../module-car/events/index.js'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'

@EventsHandler(CarCreatedV1)
export class CarCreatedEventHandler implements IEventHandler<CarCreatedV1> {
  constructor(private repository: CustomerWithCarsProjection) {}

  async handle(event: CarCreatedV1) {
    const { owner, id: carID, ownerID, ...carData } = event.toJson()
    const { version: customerVersion, id: customerID, ...ownerData } = owner

    await this.repository.save({
      ...carData,
      ...ownerData,
      carID,
      customerID: customerID || ownerID,
      customerVersion,
      carVersion: 1
    })
  }
}
