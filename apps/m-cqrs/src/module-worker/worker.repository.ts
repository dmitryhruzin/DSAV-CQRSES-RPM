import { Injectable } from '@nestjs/common'
import knex from 'knex'
import { InjectConnection } from 'nest-knexjs'
import { Event } from '../types/common.js'
import { WorkerAggregate } from './worker.aggregate.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateWorkerData, WorkerSnapshotDBRecord, WorkerSnapshotDBUpdatePayload } from '../types/worker.js'

const mapPayloadToDbFormat = (payload: WorkerSnapshotDBUpdatePayload): WorkerSnapshotDBRecord => ({
  id: payload.id,
  hourly_rate: payload.hourlyRate,
  role: payload.role,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): AggregateWorkerData => ({
  id: dbRecord.id,
  hourlyRate: dbRecord.hourly_rate,
  role: dbRecord.role,
  deletedAt: dbRecord.deleted_at,
  version: dbRecord.version
})

@Injectable()
export class WorkerRepository {
  private tableName: string = 'aggregate-workers'

  private cache: { [key: string]: WorkerAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() private readonly knexConnection: knex.Knex
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('hourly_rate')
        table.string('role')
        table.timestamp('deleted_at')
        table.integer('version')
      })
    }
  }

  async buildWorkerAggregate(id?: string): Promise<WorkerAggregate> {
    if (!id) {
      return new WorkerAggregate()
    }

    if (this.cache[id]) {
      return this.cache[id]
    }

    const data = await this.knexConnection.table(this.tableName).where({ id }).first()
    if (!data) {
      throw new Error(`No snapshot found for Worker with id: ${id}`)
    }
    const aggregate = new WorkerAggregate(mapPayloadFromDbFormat(data))
    this.cache[id] = aggregate

    return aggregate
  }

  async save(aggregate: WorkerAggregate, events: Event[]): Promise<boolean> {
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
