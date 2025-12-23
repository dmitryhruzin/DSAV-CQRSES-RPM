import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { WorkMain, WorkMainDBUpdatePayload, WorkMainDBRecord } from '../../types/work.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'

const mapPayloadToDbFormat = (payload: WorkMainDBUpdatePayload): WorkMainDBRecord => ({
  id: payload.id,
  title: payload.title,
  description: payload.description,
  estimate: payload.estimate,
  status: payload.status,
  assigned_to: payload.assignedTo,
  order_id: payload.orderID,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): WorkMain => ({
  id: dbRecord.id,
  title: dbRecord.title,
  description: dbRecord.description,
  estimate: dbRecord.estimate ? dbRecord.estimate : undefined,
  status: dbRecord.status,
  assignedTo: dbRecord.assigned_to ? dbRecord.assigned_to : undefined,
  orderID: dbRecord.order_id ? dbRecord.order_id : undefined
})

@Injectable()
export class WorkMainProjection {
  private tableName: string = 'works'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(WorkMainProjection.name) private readonly logger: Logger
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('description')
        table.string('estimate')
        table.string('status')
        table.string('assigned_to')
        table.string('order_id')
        table.integer('version')
      })
    }
  }

  async save(record: WorkMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: WorkMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Work with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
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

  async getAll(page: number, pageSize: number): Promise<Paginated<WorkMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'description', 'estimate', 'status', 'assigned_to', 'order_id')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<WorkMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'description', 'estimate', 'status', 'assigned_to', 'order_id')
      .where({ id })
      .first()

    if (!record) {
      throw new Error(`Work with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const aggregateTable = 'aggregate-works'

    await this.knexConnection.table(this.tableName).del()

    let records = await this.knexConnection.table(aggregateTable).orderBy('id', 'asc').limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        records.map((r) => ({
          id: r.id,
          version: r.version,
          title: r.title,
          description: r.description,
          estimate: r.estimate,
          status: r.status,
          assigned_to: r.assigned_to,
          order_id: r.order_id
        }))
      )

      this.logger.info(`Applied work from ${records[0].id} to ${records[records.length - 1].id}`)
      records = await this.knexConnection
        .table(aggregateTable)
        .where('id', '>', records[records.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Rebuild projection finished!')
  }
}
