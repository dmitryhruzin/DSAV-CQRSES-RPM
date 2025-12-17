import { Injectable } from '@nestjs/common'
import { Event, StoredEvent } from '../types/common.js'
import { CarAggregate } from './car.aggregate.js'
import { CarCreatedV1, CarOwnerChangedV1, CarMileageRecordedV1, CarDeletedV1 } from './events/index.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import {
  CarCreatedV1EventPayload,
  CarOwnerChangedV1EventPayload,
  CarMileageRecordedV1EventPayload,
  CarDeletedV1EventPayload
} from '../types/car.js'

@Injectable()
export class CarRepository {
  private cache: { [key: string]: CarAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly snapshotRepository: AggregateSnapshotRepository
  ) {}

  async buildCarAggregate(id?: string): Promise<CarAggregate> {
    if (!id) {
      return new CarAggregate()
    }

    if (this.cache[id]) {
      const aggregateFromCache = this.cache[id]

      const events = await this.eventStore.getEventsByAggregateId(id, aggregateFromCache.version || 0)
      const aggregate: CarAggregate = events.reduce(this.replayEvent, aggregateFromCache)

      this.cache[id] = aggregate

      return aggregate
    }

    const snapshot = await this.snapshotRepository.getLatestSnapshotByAggregateId<CarAggregate>(id)
    const events = await this.eventStore.getEventsByAggregateId(id, snapshot?.aggregateVersion || 0)
    const aggregate: CarAggregate = events.reduce(this.replayEvent, new CarAggregate(snapshot))

    this.cache[id] = aggregate

    return aggregate
  }

  replayEvent(this: void, aggregate: CarAggregate, event: StoredEvent): CarAggregate {
    const eventPayload = {
      ...event.body,
      aggregateId: aggregate.id,
      aggregateVersion: event.aggregateVersion
    }
    if (event.name === 'CarCreated') {
      if (event.version === 1) {
        aggregate.replayCarCreatedV1(new CarCreatedV1(eventPayload as CarCreatedV1EventPayload))
      } else {
        throw new Error(`CarCreated replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'CarOwnerChanged') {
      if (event.version === 1) {
        aggregate.replayCarOwnerChangedV1(new CarOwnerChangedV1(eventPayload as CarOwnerChangedV1EventPayload))
      } else {
        throw new Error(`CarOwnerChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'CarMileageRecorded') {
      if (event.version === 1) {
        aggregate.replayCarMileageRecordedV1(new CarMileageRecordedV1(eventPayload as CarMileageRecordedV1EventPayload))
      } else {
        throw new Error(`CarMileageRecorded replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'CarDeleted') {
      if (event.version === 1) {
        aggregate.replayCarDeletedV1(new CarDeletedV1(eventPayload as CarDeletedV1EventPayload))
      } else {
        throw new Error(`CarDeleted replay. Unprocesible event version ${event.version}`)
      }
    } else {
      throw new Error(`Car aggregate replay. Unprocesible event ${event.name}`)
    }
    return aggregate
  }

  shouldCreateSnapshot(aggregateVersion: number, eventsLength: number): boolean {
    return (aggregateVersion + eventsLength) % 5 === 0
  }

  async save(aggregate: CarAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    await this.eventStore.saveEvents(aggregateId, events)

    if (this.shouldCreateSnapshot(aggregate.version, events.length)) {
      await this.snapshotRepository.saveSnapshot(aggregate)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
