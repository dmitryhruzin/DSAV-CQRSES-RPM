import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkRemovedFromOrderV1 } from '../events/index.js'

@EventsHandler(WorkRemovedFromOrderV1)
export class WorkRemovedFromOrderEventHandler implements IEventHandler<WorkRemovedFromOrderV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkRemovedFromOrderV1) {
    await this.repository.update(event.aggregateId, {
      orderID: undefined,
      version: event.aggregateVersion
    })
  }
}
