import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'
import { CarMileageRecordedV1 } from '../../module-car/events/index.js'

@EventsHandler(CarMileageRecordedV1)
export class CarMileageRecordedEventHandler implements IEventHandler<CarMileageRecordedV1> {
  constructor(private repository: CustomerWithCarsProjection) {}

  async handle(event: CarMileageRecordedV1) {
    await this.repository.updateCar(event.aggregateId, {
      mileage: event.mileage,
      carVersion: event.aggregateVersion
    })
  }
}
