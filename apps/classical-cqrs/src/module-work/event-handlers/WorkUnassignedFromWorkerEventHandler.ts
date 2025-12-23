import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkUnassignedFromWorkerV1 } from '../events/index.js'

@EventsHandler(WorkUnassignedFromWorkerV1)
export class WorkUnassignedFromWorkerEventHandler implements IEventHandler<WorkUnassignedFromWorkerV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkUnassignedFromWorkerV1) {
    await this.repository.update(event.aggregateId, {
      assignedTo: null,
      version: event.aggregateVersion
    })
  }
}
