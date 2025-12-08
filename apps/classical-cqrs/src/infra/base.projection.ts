import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { Logger } from '@DSAV-CQRSES-RPM/logger'

@Injectable()
export class BaseProjection {
  tableName: string

  snapshotTableName: string

  knexConnection: knex.Knex

  logger: Logger

  constructor(knexConnection: knex.Knex, logger: Logger, tableName: string) {
    this.knexConnection = knexConnection
    this.logger = logger
    this.tableName = tableName
    this.snapshotTableName = `${tableName}-snapshot`
  }

  async createSnapshot(lastEventID: number = 0) {
    await this.knexConnection.table(this.snapshotTableName).del()

    let records = await this.knexConnection.table(this.tableName).orderBy('id', 'asc').limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.snapshotTableName).insert(records.map((u) => ({ ...u, lastEventID })))

      this.logger.info(`Copied records from ${records[0].id} to ${records[records.length - 1].id}`)

      records = await this.knexConnection
        .table(this.tableName)
        .where('id', '>', records[records.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Snapshot created!')
  }

  async applySnapshot(): Promise<number> {
    await this.knexConnection.table(this.tableName).del()

    let records = await this.knexConnection.table(this.snapshotTableName).orderBy('id', 'asc').limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        records.map((r) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { lastEventID: omitted, ...record } = r
          return record
        })
      )

      this.logger.info(`Copied records from ${records[0].id} to ${records[records.length - 1].id}`)

      records = await this.knexConnection
        .table(this.snapshotTableName)
        .where('id', '>', records[records.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Snapshot applied!')

    const lastEventRecord = await this.knexConnection
      .table(this.snapshotTableName)
      .orderBy('lastEventID', 'desc')
      .limit(1)
    return lastEventRecord.length ? lastEventRecord[0].lastEventID : 0
  }
}
