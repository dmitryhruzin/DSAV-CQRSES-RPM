import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkCreatedV1 } from '../events/index.js'
import { WorkMainProjection } from '../projections/work-main.projection.js'

@EventsHandler(WorkCreatedV1)
export class WorkCreatedEventHandler implements IEventHandler<WorkCreatedV1> {
  constructor(private repository: WorkMainProjection) {}
  async handle(event: WorkCreatedV1) {
    await this.repository.save({ ...event.toJson(), version: 1 })
  }
}
