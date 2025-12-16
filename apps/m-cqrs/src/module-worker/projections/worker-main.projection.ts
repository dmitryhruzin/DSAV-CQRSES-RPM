import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkerMain, WorkerMainDBUpdatePayload, WorkerMainDBRecord } from '../../types/worker.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'

const mapPayloadToDbFormat = (payload: WorkerMainDBUpdatePayload): WorkerMainDBRecord => ({
  id: payload.id,
  hourly_rate: payload.hourlyRate,
  role: payload.role,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): WorkerMain => ({
  id: dbRecord.id,
  hourlyRate: dbRecord.hourly_rate,
  role: dbRecord.role
})

@Injectable()
export class WorkerMainProjection {
  private tableName: string = 'workers'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(WorkerMainProjection.name) private readonly logger: Logger
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

  async save(record: WorkerMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: WorkerMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Worker with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
        )
      }
      await this.knexConnection
        .table(this.tableName)
        .transacting(trx)
        .update(mapPayloadToDbFormat(payload))
        .where({ id })
      await trx.commit()

      return true
    } catch (e) {
      await trx.rollback()

      if (e instanceof VersionMismatchError) {
        if (tryCounter < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return this.update(id, payload, tryCounter + 1)
        } else {
          this.logger.warn(e)
          return true
        }
      }
      throw e
    }
  }

  async getAll(page: number, pageSize: number): Promise<Paginated<WorkerMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'hourly_rate', 'role')
      .whereNull('deleted_at')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<WorkerMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'hourly_rate', 'role')
      .where({ id })
      .whereNull('deleted_at')
      .first()

    if (!record) {
      throw new Error(`Worker with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const aggregateTable = 'aggregate-workers'

    await this.knexConnection.table(this.tableName).del()

    let records = await this.knexConnection.table(aggregateTable).orderBy('id', 'asc').limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        records.map((r) => ({
          id: r.id,
          version: r.version,
          hourly_rate: r.hourly_rate,
          role: r.role,
          deleted_at: r.deleted_at
        }))
      )

      this.logger.info(`Applied workers from ${records[0].id} to ${records[records.length - 1].id}`)
      records = await this.knexConnection
        .table(aggregateTable)
        .where('id', '>', records[records.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Rebuild projection finished!')
  }
}
