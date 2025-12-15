import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CarCreatedV1 } from '../events/index.js'
import { CarMainProjection } from '../projections/car-main.projection.js'

@EventsHandler(CarCreatedV1)
export class CarCreatedEventHandler implements IEventHandler<CarCreatedV1> {
  constructor(private repository: CarMainProjection) {}

  async handle(event: CarCreatedV1) {
    await this.repository.save({ ...event.toJson(), version: 1 })
  }
}
