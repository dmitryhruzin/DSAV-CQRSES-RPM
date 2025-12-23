import { Injectable } from '@nestjs/common'
import knex from 'knex'
import { InjectConnection } from 'nest-knexjs'
import { Event } from '../types/common.js'
import { WorkAggregate } from './work.aggregate.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateWorkData, WorkSnapshotDBRecord, WorkSnapshotDBUpdatePayload } from '../types/work.js'

const mapPayloadToDbFormat = (payload: WorkSnapshotDBUpdatePayload): WorkSnapshotDBRecord => ({
  id: payload.id,
  title: payload.title,
  description: payload.description,
  estimate: payload.estimate,
  status: payload.status,
  assigned_to: payload.assignedTo,
  order_id: payload.orderID,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): AggregateWorkData => ({
  id: dbRecord.id,
  title: dbRecord.title,
  description: dbRecord.description,
  estimate: dbRecord.estimate ? dbRecord.estimate : undefined,
  status: dbRecord.status,
  assignedTo: dbRecord.assigned_to ? dbRecord.assigned_to : undefined,
  orderID: dbRecord.order_id ? dbRecord.order_id : undefined,
  version: dbRecord.version
})

@Injectable()
export class WorkRepository {
  private tableName: string = 'aggregate-works'

  private cache: { [key: string]: WorkAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() private readonly knexConnection: knex.Knex
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('description')
        table.string('estimate')
        table.string('status')
        table.string('assigned_to')
        table.string('order_id')
        table.integer('version')
      })
    }
  }

  async buildWorkAggregate(id?: string): Promise<WorkAggregate> {
    if (!id) {
      return new WorkAggregate()
    }

    if (this.cache[id]) {
      return this.cache[id]
    }

    const data = await this.knexConnection.table(this.tableName).where({ id }).first()
    if (!data) {
      throw new Error(`No snapshot found for Work with id: ${id}`)
    }
    const aggregate = new WorkAggregate(mapPayloadFromDbFormat(data))
    this.cache[id] = aggregate

    return aggregate
  }

  async save(aggregate: WorkAggregate, events: Event[]): Promise<boolean> {
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
