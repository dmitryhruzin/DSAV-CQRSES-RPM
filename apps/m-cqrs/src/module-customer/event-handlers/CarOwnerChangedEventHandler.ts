import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'
import { CarOwnerChangedV1 } from '../../module-car/events/index.js'

@EventsHandler(CarOwnerChangedV1)
export class CarOwnerChangedEventHandler implements IEventHandler<CarOwnerChangedV1> {
  constructor(private repository: CustomerWithCarsProjection) {}

  async handle(event: CarOwnerChangedV1) {
    const { owner } = event.toJson()
    const { version: customerVersion, id: customerID, ...ownerData } = owner

    await this.repository.updateCar(event.aggregateId, {
      ...ownerData,
      customerID,
      customerVersion,
      carVersion: event.aggregateVersion
    })
  }
}
