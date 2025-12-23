import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkStatusChangedV1 } from '../events/index.js'

@EventsHandler(WorkStatusChangedV1)
export class WorkStatusChangedEventHandler implements IEventHandler<WorkStatusChangedV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkStatusChangedV1) {
    await this.repository.update(event.aggregateId, {
      status: event.status,
      version: event.aggregateVersion
    })
  }
}
