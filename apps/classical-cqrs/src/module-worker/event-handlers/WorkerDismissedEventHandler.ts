import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerDismissedV1 } from '../events/WorkerDismissedV1.js'

@EventsHandler(WorkerDismissedV1)
export class WorkerDismissedEventHandler implements IEventHandler<WorkerDismissedV1> {
  constructor(private repository: WorkerMainProjection) {}

  async handle(event: WorkerDismissedV1) {
    await this.repository.update(event.aggregateId, {
      deletedAt: event.deletedAt,
      version: event.aggregateVersion
    })
  }
}
