import { Injectable } from '@nestjs/common'
import knex from 'knex'
import { InjectConnection } from 'nest-knexjs'
import { Event } from '../types/common.js'
import { CarAggregate } from './car.aggregate.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateCarData, CarSnapshotDBRecord, CarSnapshotDBUpdatePayload } from '../types/car.js'

const mapPayloadToDbFormat = (payload: CarSnapshotDBUpdatePayload): CarSnapshotDBRecord => ({
  id: payload.id,
  owner_id: payload.ownerID,
  vin: payload.vin,
  registration_number: payload.registrationNumber,
  mileage: payload.mileage,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): AggregateCarData => ({
  id: dbRecord.id,
  ownerID: dbRecord.owner_id,
  vin: dbRecord.vin,
  registrationNumber: dbRecord.registration_number,
  mileage: dbRecord.mileage,
  deletedAt: dbRecord.deleted_at,
  version: dbRecord.version
})

@Injectable()
export class CarRepository {
  private tableName: string = 'aggregate-cars'

  private cache: { [key: string]: CarAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() private readonly knexConnection: knex.Knex
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('owner_id')
        table.string('vin')
        table.string('registration_number')
        table.integer('mileage')
        table.timestamp('deleted_at')
        table.integer('version')
      })
    }
  }

  async buildCarAggregate(id?: string): Promise<CarAggregate> {
    if (!id) {
      return new CarAggregate()
    }

    if (this.cache[id]) {
      return this.cache[id]
    }

    const data = await this.knexConnection.table(this.tableName).where({ id }).first()
    if (!data) {
      throw new Error(`No snapshot found for Car with id: ${id}`)
    }
    const aggregate = new CarAggregate(mapPayloadFromDbFormat(data))

    this.cache[id] = aggregate

    return aggregate
  }

  async save(aggregate: CarAggregate, events: Event[]): Promise<boolean> {
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
