import { Injectable } from '@nestjs/common'
import knex from 'knex'
import { InjectConnection } from 'nest-knexjs'
import { Event } from '../types/common.js'
import { AggregateUserData } from '../types/user.js'
import { UserAggregate } from './user.aggregate.js'
import { EventStoreRepository } from '../infra/event-store.repository.js'

const mapPayloadToDbFormat = (payload: AggregateUserData) => {
  const result = { ...payload, isinsystem: payload.isInSystem }
  delete result.isInSystem
  return result
}

const mapPayloadFromDbFormat = (dbRecord: any): AggregateUserData => ({
  ...dbRecord,
  isInSystem: dbRecord.isinsystem,
  isinsystem: undefined
})

@Injectable()
export class UserRepository {
  private tableName: string = 'aggregate-users'

  private cache: { [key: string]: UserAggregate } = {}

  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() private readonly knexConnection: knex.Knex
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('password')
        table.boolean('isinsystem')
        table.integer('version')
      })
    }
  }

  async buildUserAggregate(id?: string): Promise<UserAggregate> {
    if (!id) {
      return new UserAggregate()
    }

    if (this.cache[id]) {
      return this.cache[id]
    }

    const data = await this.knexConnection.table(this.tableName).where({ id }).first()
    if (!data) {
      throw new Error(`No snapshot found for User with id: ${id}`)
    }
    const aggregate = new UserAggregate(mapPayloadFromDbFormat(data))

    this.cache[id] = aggregate

    return aggregate
  }

  async save(aggregate: UserAggregate, events: Event[]): Promise<boolean> {
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
