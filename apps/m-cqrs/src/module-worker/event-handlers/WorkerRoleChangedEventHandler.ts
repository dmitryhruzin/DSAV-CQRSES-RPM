import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerRoleChangedV1 } from '../events/index.js'

@EventsHandler(WorkerRoleChangedV1)
export class WorkerRoleChangedEventHandler implements IEventHandler<WorkerRoleChangedV1> {
  constructor(private repository: WorkerMainProjection) {}

  async handle(event: WorkerRoleChangedV1) {
    await this.repository.update(event.aggregateId, {
      role: event.role,
      version: event.aggregateVersion
    })
  }
}
