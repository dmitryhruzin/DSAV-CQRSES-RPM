import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { CarOwnerChangedV1 } from '../events/index.js'

@EventsHandler(CarOwnerChangedV1)
export class CarOwnerChangedEventHandler implements IEventHandler<CarOwnerChangedV1> {
  constructor(private repository: CarMainProjection) {}

  async handle(event: CarOwnerChangedV1) {
    await this.repository.update(event.aggregateId, {
      ownerID: event.ownerID,
      version: event.aggregateVersion
    })
  }
}
