import { Injectable } from '@nestjs/common'
import { Event, StoredEvent } from '../types/common.js'
import { CustomerAggregate } from './customer.aggregate.js'
import { CustomerCreatedV1, CustomerDeletedV1, CustomerRenamedV1, CustomerContactsChangedV1 } from './events/index.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import {
  CustomerCreatedV1EventPayload,
  CustomerDeletedV1EventPayload,
  CustomerRenamedV1EventPayload,
  CustomerContactsChangedV1EventPayload
} from '../types/customer.js'

@Injectable()
export class CustomerRepository {
  private cache: { [key: string]: CustomerAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly snapshotRepository: AggregateSnapshotRepository
  ) {}

  async buildCustomerAggregate(id?: string): Promise<CustomerAggregate> {
    if (!id) {
      return new CustomerAggregate()
    }

    if (this.cache[id]) {
      const aggregateFromCache = this.cache[id]

      const events = await this.eventStore.getEventsByAggregateId(id, aggregateFromCache.version || 0)
      const aggregate: CustomerAggregate = events.reduce(this.replayEvent, aggregateFromCache)

      this.cache[id] = aggregate

      return aggregate
    }

    const snapshot = await this.snapshotRepository.getLatestSnapshotByAggregateId<CustomerAggregate>(id)
    const events = await this.eventStore.getEventsByAggregateId(id, snapshot?.aggregateVersion || 0)
    const aggregate: CustomerAggregate = events.reduce(this.replayEvent, new CustomerAggregate(snapshot))

    this.cache[id] = aggregate

    return aggregate
  }

  replayEvent(this: void, aggregate: CustomerAggregate, event: StoredEvent): CustomerAggregate {
    const eventPayload = {
      ...event.body,
      aggregateId: aggregate.id,
      aggregateVersion: event.aggregateVersion
    }
    if (event.name === 'CustomerCreated') {
      if (event.version === 1) {
        aggregate.replayCustomerCreatedV1(new CustomerCreatedV1(eventPayload as CustomerCreatedV1EventPayload))
      } else {
        throw new Error(`CustomerCreated replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'CustomerRenamed') {
      if (event.version === 1) {
        aggregate.replayCustomerRenamedV1(new CustomerRenamedV1(eventPayload as CustomerRenamedV1EventPayload))
      } else {
        throw new Error(`CustomerRenamed replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'CustomerContactsChanged') {
      if (event.version === 1) {
        aggregate.replayCustomerContactsChangedV1(
          new CustomerContactsChangedV1(eventPayload as CustomerContactsChangedV1EventPayload)
        )
      } else {
        throw new Error(`CustomerRenamed replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'CustomerDeleted') {
      if (event.version === 1) {
        aggregate.replayCustomerDeletedV1(new CustomerDeletedV1(eventPayload as CustomerDeletedV1EventPayload))
      } else {
        throw new Error(`CustomerDeleted replay. Unprocesible event version ${event.version}`)
      }
    } else {
      throw new Error(`Customer aggregate replay. Unprocesible event ${event.name}`)
    }
    return aggregate
  }

  shouldCreateSnapshot(aggregateVersion: number, eventsLength: number): boolean {
    return (aggregateVersion + eventsLength) % 50 === 0
  }

  async save(aggregate: CustomerAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    await this.eventStore.saveEvents(aggregateId, events)

    if (this.shouldCreateSnapshot(aggregate.version, events.length)) {
      await this.snapshotRepository.saveSnapshot(aggregate)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
