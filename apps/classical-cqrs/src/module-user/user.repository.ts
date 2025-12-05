import { Injectable } from '@nestjs/common'
import { Event, StoredEvent } from '../types/common.js'
import { UserAggregate } from './user.aggregate.js'
import { UserCreatedV1 } from './events/index.js'
import { EventStoreRepository } from '../infra/event-store-module/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-module/aggregate-snapshot.repository.js'
import { UserCreatedV1EventPayload } from '../types/user.js'

@Injectable()
export class UserRepository {
  private cache: { [key: string]: UserAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly snapshotRepository: AggregateSnapshotRepository
  ) {}

  async buildUserAggregate(id?: string): Promise<UserAggregate> {
    if (!id) {
      return new UserAggregate()
    }

    if (this.cache[id]) {
      const aggregateFromCache = this.cache[id]

      const events = await this.eventStore.getEventsByAggregateId(id, aggregateFromCache.version || 0)
      const aggregate: UserAggregate = events.reduce(this.replayEvent, aggregateFromCache)

      this.cache[id] = aggregate

      return aggregate
    }

    const snapshot = await this.snapshotRepository.getLatestSnapshotByAggregateId<UserAggregate>(id)
    const events = await this.eventStore.getEventsByAggregateId(id, snapshot?.aggregateVersion || 0)
    const aggregate: UserAggregate = events.reduce(this.replayEvent, new UserAggregate(snapshot))

    this.cache[id] = aggregate

    return aggregate
  }

  replayEvent(aggregate: UserAggregate, event: StoredEvent) {
    const eventPayload = {
      ...event.body,
      aggregateId: aggregate.id,
      aggregateVersion: event.aggregateVersion
    }
    if (event.name === 'UserCreated') {
      if (event.version === 1) {
        aggregate.replayUserCreatedV1(new UserCreatedV1(eventPayload as UserCreatedV1EventPayload))
      } else {
        throw new Error(`UserCreated replay. Unprocesible event version ${event.version}`)
      }
    } else {
      throw new Error(`User aggregate replay. Unprocesible event ${event.name}`)
    }
    return aggregate
  }

  shouldCreateSnapshot(aggregateVersion: number, eventsLength: number): boolean {
    return (aggregateVersion + eventsLength) % 50 === 0
  }

  async save(aggregate: UserAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    await this.eventStore.saveEvents(aggregateId, events)

    if (this.shouldCreateSnapshot(aggregate.version, events.length)) {
      const lastAggregate = events.reduce(
        (agg, e) =>
          this.replayEvent(aggregate, {
            body: e,
            aggregateId,
            aggregateVersion: agg.version,
            version: e.version,
            name: Object.getPrototypeOf(e.constructor).name
          }),
        aggregate
      )
      this.snapshotRepository.saveSnapshot(lastAggregate)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
