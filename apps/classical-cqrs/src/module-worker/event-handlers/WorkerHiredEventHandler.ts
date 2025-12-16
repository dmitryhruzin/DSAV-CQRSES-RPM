import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkerHiredV1 } from '../events/index.js'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'

@EventsHandler(WorkerHiredV1)
export class WorkerHiredEventHandler implements IEventHandler<WorkerHiredV1> {
  constructor(private repository: WorkerMainProjection) {}

  async handle(event: WorkerHiredV1) {
    await this.repository.save({ ...event.toJson(), version: 1 })
  }
}
