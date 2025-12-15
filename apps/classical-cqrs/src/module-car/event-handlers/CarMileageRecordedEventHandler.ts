import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { CarMileageRecordedV1 } from '../events/index.js'

@EventsHandler(CarMileageRecordedV1)
export class CarMileageRecordedEventHandler implements IEventHandler<CarMileageRecordedV1> {
  constructor(private repository: CarMainProjection) {}

  async handle(event: CarMileageRecordedV1) {
    await this.repository.update(event.aggregateId, {
      mileage: event.mileage,
      version: event.aggregateVersion
    })
  }
}
