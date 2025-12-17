import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { Aggregate } from '../infra/aggregate.js'
import { Snapshot } from '../types/common.js'

@Injectable()
export class AggregateSnapshotRepository {
  private tableName: string = 'snapshots'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(AggregateSnapshotRepository.name) private readonly logger: Logger
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.increments('id').primary()
        table.string('aggregate_id')
        table.integer('aggregate_version')
        table.jsonb('state')
      })
    }
  }

  async getLatestSnapshotByAggregateId<T>(id: string): Promise<Snapshot<T>> {
    const snapshot = await this.knexConnection
      .table(this.tableName)
      .where({ aggregate_id: id })
      .orderBy('aggregate_version', 'desc')
      .first()

    if (!snapshot) {
      return null
    }

    return {
      id: snapshot.id,
      aggregateId: snapshot.aggregate_id,
      aggregateVersion: snapshot.aggregate_version,
      state: typeof snapshot.state === 'object' ? snapshot.state : JSON.parse(snapshot.state as string)
    }
  }

  async saveSnapshot(aggregate: Aggregate): Promise<boolean> {
    if (!aggregate) {
      this.logger.warn('Can not save snapshot. Aggregate is not defined.')
      return false
    }

    await this.knexConnection.table(this.tableName).insert({
      aggregate_id: aggregate.id,
      aggregate_version: aggregate.version,
      state: aggregate.toJson()
    })

    return true
  }
}
