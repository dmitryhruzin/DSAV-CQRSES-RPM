import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkTitleChangedV1 } from '../events/index.js'

@EventsHandler(WorkTitleChangedV1)
export class WorkTitleChangedEventHandler implements IEventHandler<WorkTitleChangedV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkTitleChangedV1) {
    await this.repository.update(event.aggregateId, {
      title: event.title,
      version: event.aggregateVersion
    })
  }
}
