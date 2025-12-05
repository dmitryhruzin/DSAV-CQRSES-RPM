import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { Event, StoredEvent, StoredEventWithID } from '../../types/common.js'

/**
 * Repository for managing event store operations.
 *
 * @class EventStoreRepository
 */
@Injectable()
export class EventStoreRepository {
  private tableName: string = 'events'

  /**
   * Constructs an instance of EventStoreRepository.
   *
   * @param {Knex} knex - The knex instance for database operations.
   * @param {Logger} logger - The logger instance.
   */
  constructor(
    // @ts-ignore
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(EventStoreRepository.name) private readonly logger: Logger
  ) {}

  /**
   * Initializes the repository and creates the events table if it doesn't exist.
   *
   * This method is called during the module initialization phase.
   */
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

  /**
   * Retrieves events by aggregate ID.
   *
   * @param {string} id - The aggregate ID.
   * @returns {Promise<StoredEvent[]>} The list of stored events.
   *
   * This method queries the event store to retrieve all events associated with a specific aggregate ID.
   */
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

  /**
   * Saves events to the event store.
   *
   * @param {string} aggregateId - The aggregate ID.
   * @param {Event[]} events - The list of events to save.
   * @returns {Promise<boolean>} Whether the events were successfully saved.
   *
   * This method inserts a list of events into the event store, associated with the specified aggregate ID.
   */
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
