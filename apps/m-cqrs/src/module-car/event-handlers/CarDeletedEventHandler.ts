import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { CarDeletedV1 } from '../events/CarDeletedV1.js'

@EventsHandler(CarDeletedV1)
export class CarDeletedEventHandler implements IEventHandler<CarDeletedV1> {
  constructor(private repository: CarMainProjection) {}

  async handle(event: CarDeletedV1) {
    console.log('Handling CarDeletedV1 event for Car ID:', event.aggregateId)
    await this.repository.update(event.aggregateId, {
      deletedAt: event.deletedAt,
      version: event.aggregateVersion
    })
  }
}
