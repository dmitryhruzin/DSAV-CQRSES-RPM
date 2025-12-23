import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkDescriptionChangedV1 } from '../events/index.js'

@EventsHandler(WorkDescriptionChangedV1)
export class WorkDescriptionChangedEventHandler implements IEventHandler<WorkDescriptionChangedV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkDescriptionChangedV1) {
    await this.repository.update(event.aggregateId, {
      description: event.description,
      version: event.aggregateVersion
    })
  }
}
