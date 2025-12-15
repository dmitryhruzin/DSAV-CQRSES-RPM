import { Injectable } from '@nestjs/common'
import knex from 'knex'
import { InjectConnection } from 'nest-knexjs'
import { Event } from '../types/common.js'
import { CustomerAggregate } from './customer.aggregate.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'
import { AggregateCustomerData, CustomerSnapshotDBRecord, CustomerSnapshotDBUpdatePayload } from '../types/customer.js'

const mapPayloadToDbFormat = (payload: CustomerSnapshotDBUpdatePayload): CustomerSnapshotDBRecord => ({
  id: payload.id,
  user_id: payload.userID,
  first_name: payload.firstName,
  last_name: payload.lastName,
  phone_number: payload.phoneNumber,
  email: payload.email,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): AggregateCustomerData => ({
  id: dbRecord.id,
  userID: dbRecord.user_id,
  firstName: dbRecord.first_name,
  lastName: dbRecord.last_name,
  phoneNumber: dbRecord.phone_number,
  email: dbRecord.email,
  deletedAt: dbRecord.deleted_at,
  version: dbRecord.version
})

@Injectable()
export class CustomerRepository {
  private tableName: string = 'aggregate-customers'

  private cache: { [key: string]: CustomerAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() private readonly knexConnection: knex.Knex
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('user_id')
        table.string('first_name')
        table.string('last_name')
        table.string('email')
        table.string('phone_number')
        table.timestamp('deleted_at')
        table.integer('version')
      })
    }
  }

  async buildCustomerAggregate(id?: string): Promise<CustomerAggregate> {
    if (!id) {
      return new CustomerAggregate()
    }

    if (this.cache[id]) {
      return this.cache[id]
    }

    const data = await this.knexConnection.table(this.tableName).where({ id }).first()
    if (!data) {
      throw new Error(`No snapshot found for Customer with id: ${id}`)
    }
    const aggregate = new CustomerAggregate(mapPayloadFromDbFormat(data))

    this.cache[id] = aggregate

    return aggregate
  }

  async save(aggregate: CustomerAggregate, events: Event[]): Promise<boolean> {
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
