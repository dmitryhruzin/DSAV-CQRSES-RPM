import { Injectable } from '@nestjs/common'
import knex from 'knex'
import { InjectConnection } from 'nest-knexjs'
import { Event } from '../types/common.js'
import { OrderAggregate } from './order.aggregate.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateOrderData, OrderSnapshotDBRecord, OrderSnapshotDBUpdatePayload } from '../types/order.js'

const mapPayloadToDbFormat = (payload: OrderSnapshotDBUpdatePayload): OrderSnapshotDBRecord => ({
  id: payload.id,
  title: payload.title,
  price: payload.price,
  discount: payload.discount,
  priority: payload.priority,
  status: payload.status,
  approved: payload.approved,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): AggregateOrderData => ({
  id: dbRecord.id,
  title: dbRecord.title,
  price: dbRecord.price,
  discount: dbRecord.discount,
  priority: dbRecord.priority,
  status: dbRecord.status,
  approved: dbRecord.approved,
  version: dbRecord.version
})

@Injectable()
export class OrderRepository {
  private tableName: string = 'aggregate-orders'

  private cache: { [key: string]: OrderAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() private readonly knexConnection: knex.Knex
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('price')
        table.string('discount')
        table.integer('priority')
        table.string('status')
        table.boolean('approved')
        table.integer('version')
      })
    }
  }

  async buildOrderAggregate(id?: string): Promise<OrderAggregate> {
    if (!id) {
      return new OrderAggregate()
    }

    if (this.cache[id]) {
      return this.cache[id]
    }

    const data = await this.knexConnection.table(this.tableName).where({ id }).first()
    if (!data) {
      throw new Error(`No snapshot found for Order with id: ${id}`)
    }
    const aggregate = new OrderAggregate(mapPayloadFromDbFormat(data))
    this.cache[id] = aggregate

    return aggregate
  }

  async save(aggregate: OrderAggregate, events: Event[]): Promise<boolean> {
    const aggregateId = aggregate.toJson().id

    const trx = await this.knexConnection.transaction()
    try {
      await this.eventStore.saveEvents(aggregateId, events, trx)

      await trx(this.tableName).insert(mapPayloadToDbFormat(aggregate.toJson())).onConflict('id').merge()
      await trx.commit()
    } catch (e) {
      await trx.rollback()
      throw new Error(`Can not save events. ${e as string}`)
    }

    this.cache[aggregateId] = aggregate

    return true
  }
}
