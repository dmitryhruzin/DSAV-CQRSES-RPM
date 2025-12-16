import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { WorkerHourlyRateChangedV1 } from '../events/index.js'

@EventsHandler(WorkerHourlyRateChangedV1)
export class WorkerHourlyRateChangedEventHandler implements IEventHandler<WorkerHourlyRateChangedV1> {
  constructor(private repository: WorkerMainProjection) {}

  async handle(event: WorkerHourlyRateChangedV1) {
    await this.repository.update(event.aggregateId, {
      hourlyRate: event.hourlyRate,
      version: event.aggregateVersion
    })
  }
}
