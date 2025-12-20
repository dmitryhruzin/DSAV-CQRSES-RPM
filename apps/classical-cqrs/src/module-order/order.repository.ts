import { Injectable } from '@nestjs/common'
import { Event, StoredEvent } from '../types/common.js'
import { OrderAggregate } from './order.aggregate.js'
import {
  OrderCreatedV1,
  OrderStatusChangedV1,
  OrderDiscountAppliedV1,
  OrderPriceChangedV1,
  OrderPrioritySetV1
} from './events/index.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateSnapshotRepository } from '../infra/aggregate-snapshot.repository.js'
import {
  OrderCreatedV1EventPayload,
  OrderStatusChangedV1EventPayload,
  OrderDiscountAppliedV1EventPayload,
  OrderPriceChangedV1EventPayload,
  OrderPrioritySetV1EventPayload
} from '../types/order.js'

@Injectable()
export class OrderRepository {
  private cache: { [key: string]: OrderAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    private readonly snapshotRepository: AggregateSnapshotRepository
  ) {}

  async buildOrderAggregate(id?: string): Promise<OrderAggregate> {
    if (!id) {
      return new OrderAggregate()
    }

    if (this.cache[id]) {
      const aggregateFromCache = this.cache[id]

      const events = await this.eventStore.getEventsByAggregateId(id, aggregateFromCache.version || 0)
      const aggregate: OrderAggregate = events.reduce(this.replayEvent, aggregateFromCache)

      this.cache[id] = aggregate

      return aggregate
    }

    const snapshot = await this.snapshotRepository.getLatestSnapshotByAggregateId<OrderAggregate>(id)
    const events = await this.eventStore.getEventsByAggregateId(id, snapshot?.aggregateVersion || 0)
    const aggregate: OrderAggregate = events.reduce(this.replayEvent, new OrderAggregate(snapshot))

    this.cache[id] = aggregate

    return aggregate
  }

  replayEvent(this: void, aggregate: OrderAggregate, event: StoredEvent): OrderAggregate {
    const eventPayload = {
      ...event.body,
      aggregateId: aggregate.id,
      aggregateVersion: event.aggregateVersion
    }
    if (event.name === 'OrderCreated') {
      if (event.version === 1) {
        aggregate.replayOrderCreatedV1(new OrderCreatedV1(eventPayload as OrderCreatedV1EventPayload))
      } else {
        throw new Error(`OrderCreated replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'OrderApproved') {
      if (event.version === 1) {
        aggregate.replayOrderApprovedV1()
      } else {
        throw new Error(`OrderApproved replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'OrderStatusChanged') {
      if (event.version === 1) {
        aggregate.replayOrderStatusChangedV1(new OrderStatusChangedV1(eventPayload as OrderStatusChangedV1EventPayload))
      } else {
        throw new Error(`OrderStatusChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'OrderPriceChanged') {
      if (event.version === 1) {
        aggregate.replayOrderPriceChangedV1(new OrderPriceChangedV1(eventPayload as OrderPriceChangedV1EventPayload))
      } else {
        throw new Error(`OrderPriceChanged replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'OrderDiscountApplied') {
      if (event.version === 1) {
        aggregate.replayOrderDiscountAppliedV1(
          new OrderDiscountAppliedV1(eventPayload as OrderDiscountAppliedV1EventPayload)
        )
      } else {
        throw new Error(`OrderDiscountApplied replay. Unprocesible event version ${event.version}`)
      }
    } else if (event.name === 'OrderPrioritySet') {
      if (event.version === 1) {
        aggregate.replayOrderPrioritySetV1(new OrderPrioritySetV1(eventPayload as OrderPrioritySetV1EventPayload))
      } else {
        throw new Error(`OrderPrioritySet replay. Unprocesible event version ${event.version}`)
      }
    } else {
      throw new Error(`Order aggregate replay. Unprocesible event ${event.name}`)
    }
    return aggregate
  }

  shouldCreateSnapshot(aggregateVersion: number, eventsLength: number): boolean {
    return (aggregateVersion + eventsLength) % 5 === 0
  }

  async save(aggregate: OrderAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    await this.eventStore.saveEvents(aggregateId, events)

    if (this.shouldCreateSnapshot(aggregate.version, events.length)) {
      await this.snapshotRepository.saveSnapshot(aggregate)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
