import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { WorkAssignedToWorkerV1 } from '../events/index.js'

@EventsHandler(WorkAssignedToWorkerV1)
export class WorkAssignedToWorkerEventHandler implements IEventHandler<WorkAssignedToWorkerV1> {
  constructor(private repository: WorkMainProjection) {}

  async handle(event: WorkAssignedToWorkerV1) {
    await this.repository.update(event.aggregateId, {
      assignedTo: event.workerID,
      version: event.aggregateVersion
    })
  }
}
