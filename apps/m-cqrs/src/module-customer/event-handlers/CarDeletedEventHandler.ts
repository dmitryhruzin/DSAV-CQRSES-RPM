import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CarDeletedV1 } from '../../module-car/events/CarDeletedV1.js'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'

@EventsHandler(CarDeletedV1)
export class CarDeletedEventHandler implements IEventHandler<CarDeletedV1> {
  constructor(private repository: CustomerWithCarsProjection) {}

  async handle(event: CarDeletedV1) {
    await this.repository.updateCar(event.aggregateId, {
      carDeletedAt: event.deletedAt,
      carVersion: event.aggregateVersion
    })
  }
}
