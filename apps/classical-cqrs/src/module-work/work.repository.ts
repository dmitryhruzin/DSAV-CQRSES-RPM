import { Injectable } from '@nestjs/common'
import { Event, StoredEvent } from '../types/common.js'
import { WorkAggregate } from './work.aggregate.js'
import {
  WorkAddedToOrderV1,
  WorkAssignedToWorkerV1,
  WorkCreatedV1,
  WorkDescriptionChangedV1,
  WorkEstimateSetV1,
  WorkStatusChangedV1,
  WorkTitleChangedV1
} from './events/index.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import {
  WorkAddedToOrderV1EventPayload,
  WorkAssignedToWorkerV1EventPayload,
  WorkCreatedV1EventPayload,
  WorkDescriptionChangedV1EventPayload,
  WorkEstimateSetV1EventPayload,
  WorkStatusChangedV1EventPayload,
  WorkTitleChangedV1EventPayload
} from '../types/work.js'

@Injectable()
export class WorkRepository {
  private cache: { [key: string]: WorkAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly snapshotRepository: AggregateSnapshotRepository
  ) {}

  async buildWorkAggregate(id?: string): Promise<WorkAggregate> {
    if (!id) {
      return new WorkAggregate()
    }

    if (this.cache[id]) {
      const aggregateFromCache = this.cache[id]

      const events = await this.eventStore.getEventsByAggregateId(id, aggregateFromCache.version || 0)
      const aggregate: WorkAggregate = events.reduce(this.replayEvent, aggregateFromCache)

      this.cache[id] = aggregate

      return aggregate
    }

    const snapshot = await this.snapshotRepository.getLatestSnapshotByAggregateId<WorkAggregate>(id)
    const events = await this.eventStore.getEventsByAggregateId(id, snapshot?.aggregateVersion || 0)
    const aggregate: WorkAggregate = events.reduce(this.replayEvent, new WorkAggregate(snapshot))

    this.cache[id] = aggregate

    return aggregate
  }

  replayEvent(this: void, aggregate: WorkAggregate, event: StoredEvent): WorkAggregate {
    const eventPayload = {
      ...event.body,
      aggregateId: aggregate.id,
      aggregateVersion: event.aggregateVersion
    }
    if (event.name === 'WorkCreated') {
      if (event.version === 1) {
        aggregate.replayWorkCreatedV1(new WorkCreatedV1(eventPayload as WorkCreatedV1EventPayload))
      } else {
        throw new Error(`WorkCreated replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkTitleChanged') {
      if (event.version === 1) {
        aggregate.replayWorkTitleChangedV1(new WorkTitleChangedV1(eventPayload as WorkTitleChangedV1EventPayload))
      } else {
        throw new Error(`WorkTitleChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkDescriptionChanged') {
      if (event.version === 1) {
        aggregate.replayWorkDescriptionChangedV1(
          new WorkDescriptionChangedV1(eventPayload as WorkDescriptionChangedV1EventPayload)
        )
      } else {
        throw new Error(`WorkDescriptionChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkEstimateSet') {
      if (event.version === 1) {
        aggregate.replayWorkEstimateSetV1(new WorkEstimateSetV1(eventPayload as WorkEstimateSetV1EventPayload))
      } else {
        throw new Error(`WorkEstimateSet replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkStatusChanged') {
      if (event.version === 1) {
        aggregate.replayWorkStatusChangedV1(new WorkStatusChangedV1(eventPayload as WorkStatusChangedV1EventPayload))
      } else {
        throw new Error(`WorkStatusChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkAssignedToWorker') {
      if (event.version === 1) {
        aggregate.replayWorkAssignedToWorkerV1(
          new WorkAssignedToWorkerV1(eventPayload as WorkAssignedToWorkerV1EventPayload)
        )
      } else {
        throw new Error(`WorkAssignedToWorker replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkUnassignedFromWorker') {
      if (event.version === 1) {
        aggregate.replayWorkUnassignedFromWorkerV1()
      } else {
        throw new Error(`WorkUnassignedFromWorker replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkAddedToOrder') {
      if (event.version === 1) {
        aggregate.replayWorkAddedToOrderV1(new WorkAddedToOrderV1(eventPayload as WorkAddedToOrderV1EventPayload))
      } else {
        throw new Error(`WorkAddedToOrder replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'WorkRemovedFromOrder') {
      if (event.version === 1) {
        aggregate.replayWorkRemovedFromOrderV1()
      } else {
        throw new Error(`WorkRemovedFromOrder replay. Unprocesible event version ${event.version}`)
      }
    } else {
      throw new Error(`Work aggregate replay. Unprocesible event ${event.name}`)
    }
    return aggregate
  }

  shouldCreateSnapshot(aggregateVersion: number, eventsLength: number): boolean {
    return (aggregateVersion + eventsLength) % 5 === 0
  }

  async save(aggregate: WorkAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    await this.eventStore.saveEvents(aggregateId, events)

    if (this.shouldCreateSnapshot(aggregate.version, events.length)) {
      await this.snapshotRepository.saveSnapshot(aggregate)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
