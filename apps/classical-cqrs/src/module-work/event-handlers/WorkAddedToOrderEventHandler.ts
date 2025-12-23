import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkAddedToOrderV1 } from '../events/index.js'

@EventsHandler(WorkAddedToOrderV1)
export class WorkAddedToOrderEventHandler implements IEventHandler<WorkAddedToOrderV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkAddedToOrderV1) {
    await this.repository.update(event.aggregateId, {
      orderID: event.orderID,
      version: event.aggregateVersion
    })
  }
}
