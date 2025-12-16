import { Injectable } from '@nestjs/common'
import { Event, StoredEvent } from '../types/common.js'
import { WorkerAggregate } from './worker.aggregate.js'
import { WorkerHiredV1, WorkerRoleChangedV1, WorkerHourlyRateChangedV1, WorkerDismissedV1 } from './events/index.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import {
  WorkerHiredV1EventPayload,
  WorkerRoleChangedV1EventPayload,
  WorkerHourlyRateChangedV1EventPayload,
  WorkerDismissedV1EventPayload
} from '../types/worker.js'

@Injectable()
export class WorkerRepository {
  private cache: { [key: string]: WorkerAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly snapshotRepository: AggregateSnapshotRepository
  ) {}

  async buildWorkerAggregate(id?: string): Promise<WorkerAggregate> {
    if (!id) {
      return new WorkerAggregate()
    }

    if (this.cache[id]) {
      const aggregateFromCache = this.cache[id]

      const events = await this.eventStore.getEventsByAggregateId(id, aggregateFromCache.version || 0)
      const aggregate: WorkerAggregate = events.reduce(this.replayEvent, aggregateFromCache)

      this.cache[id] = aggregate

      return aggregate
    }

    const snapshot = await this.snapshotRepository.getLatestSnapshotByAggregateId<WorkerAggregate>(id)
    const events = await this.eventStore.getEventsByAggregateId(id, snapshot?.aggregateVersion || 0)
    const aggregate: WorkerAggregate = events.reduce(this.replayEvent, new WorkerAggregate(snapshot))

    this.cache[id] = aggregate

    return aggregate
  }

  replayEvent(this: void, aggregate: WorkerAggregate, event: StoredEvent): WorkerAggregate {
    const eventPayload = {
      ...event.body,
      aggregateId: aggregate.id,
      aggregateVersion: event.aggregateVersion
    }
    if (event.name === 'WorkerHired') {
      if (event.version === 1) {
        aggregate.replayWorkerHiredV1(new WorkerHiredV1(eventPayload as WorkerHiredV1EventPayload))
      } else {
        throw new Error(`WorkerHired replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkerRoleChanged') {
      if (event.version === 1) {
        aggregate.replayWorkerRoleChangedV1(new WorkerRoleChangedV1(eventPayload as WorkerRoleChangedV1EventPayload))
      } else {
        throw new Error(`WorkerRoleChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkerHourlyRateChanged') {
      if (event.version === 1) {
        aggregate.replayWorkerHourlyRateChangedV1(
          new WorkerHourlyRateChangedV1(eventPayload as WorkerHourlyRateChangedV1EventPayload)
        )
      } else {
        throw new Error(`WorkerHourlyRateChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkerDismissed') {
      if (event.version === 1) {
        aggregate.replayWorkerDismissedV1(new WorkerDismissedV1(eventPayload as WorkerDismissedV1EventPayload))
      } else {
        throw new Error(`WorkerDismissed replay. Unprocesible event version ${event.version}`)
      }
    } else {
      throw new Error(`Worker aggregate replay. Unprocesible event ${event.name}`)
    }
    return aggregate
  }

  shouldCreateSnapshot(aggregateVersion: number, eventsLength: number): boolean {
    return (aggregateVersion + eventsLength) % 50 === 0
  }

  async save(aggregate: WorkerAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    await this.eventStore.saveEvents(aggregateId, events)

    if (this.shouldCreateSnapshot(aggregate.version, events.length)) {
      await this.snapshotRepository.saveSnapshot(aggregate)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
