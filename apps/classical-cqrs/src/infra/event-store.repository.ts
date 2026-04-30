import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { Event, StoredEvent, StoredEventWithID } from '../types/common.js'
import { TelemetryService } from '../telemetry/telemetry.service.js'

@Injectable()
export class EventStoreRepository {
  private tableName: string = 'events'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(EventStoreRepository.name) private readonly logger: Logger,
    private readonly telemetry: TelemetryService
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('aggregate_id')
        table.integer('aggregate_version')
        table.string('name')
        table.integer('version')
        table.jsonb('body')
        table.unique(['aggregate_id', 'aggregate_version'])
      })
    }
  }

  async getEventsByAggregateId(id: string, aggregateVersion = 0): Promise<StoredEvent[]> {
    return this.telemetry.time(
      'eventstore.load',
      async () => {
        const records = await this.knexConnection
          .table(this.tableName)
          .where({ aggregate_id: id })
          .andWhere('aggregate_version', '>', aggregateVersion)

        if (records.length && typeof records[0].body === 'string') {
          return records.map((r) => ({
            id: r.id,
            aggregateId: r.aggregate_id,
            aggregateVersion: r.aggregate_version,
            name: r.name,
            version: r.version,
            body: JSON.parse(r.body)
          }))
        }
        return records as StoredEvent[]
      },
      { aggregateId: id, fromVersion: aggregateVersion, op: 'getEventsByAggregateId' }
    )
  }

  async saveEvents(aggregateId: string, events: Event[]): Promise<boolean> {
    if (!aggregateId) {
      this.logger.warn('Can not save events. Aggregate ID is not defined.')
      return false
    }

    return this.telemetry.time(
      'eventstore.save',
      async () => {
        await this.knexConnection.table(this.tableName).insert(
          events.map((e) => ({
            aggregate_id: aggregateId,
            aggregate_version: e.aggregateVersion,
            name: Object.getPrototypeOf(e.constructor).name,
            version: e.version,
            body: e.toJson()
          }))
        )
        return true
      },
      { aggregateId, count: events.length }
    )
  }

  async getEventsByName(names: string[], fromID: number): Promise<StoredEventWithID[]> {
    return this.telemetry.time(
      'eventstore.load',
      () =>
        this.knexConnection
          .from(this.tableName)
          .whereIn('name', names)
          .andWhere('id', '>', fromID)
          .orderBy('id', 'asc')
          .limit(100),
      { names: names.join(','), fromID, op: 'getEventsByName' }
    )
  }
}
