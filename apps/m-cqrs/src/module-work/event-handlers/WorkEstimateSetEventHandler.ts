import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkEstimateSetV1 } from '../events/index.js'

@EventsHandler(WorkEstimateSetV1)
export class WorkEstimateSetEventHandler implements IEventHandler<WorkEstimateSetV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkEstimateSetV1) {
    await this.repository.update(event.aggregateId, {
      estimate: event.estimate,
      version: event.aggregateVersion
    })
  }
}
