import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { Event, StoredEvent, StoredEventWithID } from '../types/common.js'

@Injectable()
export class EventStoreRepository {
  private tableName: string = 'events'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(EventStoreRepository.name) private readonly logger: Logger
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('aggregateId')
        table.integer('aggregateVersion')
        table.string('name')
        table.integer('version')
        table.jsonb('body')
        table.unique(['aggregateId', 'aggregateVersion'])
      })
    }
  }

  async getEventsByAggregateId(id: string, aggregateVersion = 0): Promise<StoredEvent[]> {
    const records = await this.knexConnection
      .table(this.tableName)
      .where({ aggregateId: id })
      .andWhere('aggregateVersion', '>', aggregateVersion)

    if (records.length && typeof records[0].body === 'string') {
      return records.map((r) => ({
        ...r,
        body: JSON.parse(r.body)
      }))
    }
    return records
  }

  async saveEvents(aggregateId: string, events: Event[]): Promise<boolean> {
    if (!aggregateId) {
      this.logger.warn('Can not save events. Aggregate ID is not defined.')
      return false
    }

    await this.knexConnection.table(this.tableName).insert(
      events.map((e) => ({
        aggregateId,
        aggregateVersion: e.aggregateVersion,
        name: Object.getPrototypeOf(e.constructor).name,
        version: e.version,
        body: e.toJson()
      }))
    )

    return true
  }

  async getEventsByName(names: string[], fromID: number): Promise<StoredEventWithID[]> {
    return this.knexConnection
      .from(this.tableName)
      .whereIn('name', names)
      .andWhere('id', '>', fromID)
      .orderBy('id', 'asc')
      .limit(100)
  }
}
