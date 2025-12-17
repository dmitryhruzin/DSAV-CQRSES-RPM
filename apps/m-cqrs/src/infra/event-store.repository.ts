import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { Event } from '../types/common.js'

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
        table.string('aggregate_id')
        table.integer('aggregate_version')
        table.string('name')
        table.integer('version')
        table.jsonb('body')
        table.unique(['aggregate_id', 'aggregate_version'])
      })
    }
  }

  async saveEvents(aggregateId: string, events: Event[], trx: knex.Knex.Transaction): Promise<void> {
    if (!aggregateId) {
      throw new Error('Can not save events. Aggregate ID is not defined.')
    }

    await trx(this.tableName).insert(
      events.map((e) => ({
        aggregate_id: aggregateId,
        aggregate_version: e.aggregateVersion,
        name: Object.getPrototypeOf(e.constructor).name,
        version: e.version,
        body: e.toJson()
      }))
    )
  }
}
