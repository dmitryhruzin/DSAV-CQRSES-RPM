import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { OrderMainDBUpdatePayload, OrderMainDBRecord, OrderMain } from '../../types/order.js'

const mapPayloadToDbFormat = (payload: OrderMainDBUpdatePayload): OrderMainDBRecord => ({
  id: payload.id,
  title: payload.title,
  price: payload.price,
  discount: payload.discount,
  priority: payload.priority,
  status: payload.status,
  approved: payload.approved,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): OrderMain => ({
  id: dbRecord.id,
  title: dbRecord.title,
  price: dbRecord.price,
  discount: dbRecord.discount,
  priority: dbRecord.priority,
  status: dbRecord.status,
  approved: dbRecord.approved
})

@Injectable()
export class OrderMainProjection {
  private tableName: string = 'orders'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(OrderMainProjection.name) private readonly logger: Logger
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('title')
        table.string('price')
        table.string('discount')
        table.integer('priority')
        table.string('status')
        table.boolean('approved')
        table.integer('version')
      })
    }
  }

  async save(record: OrderMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: OrderMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Order with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
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

  async getAll(page: number, pageSize: number): Promise<Paginated<OrderMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'price', 'discount', 'priority', 'status', 'approved')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<OrderMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'title', 'price', 'discount', 'priority', 'status', 'approved')
      .where({ id })
      .first()

    if (!record) {
      throw new Error(`Order with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const aggregateTable = 'aggregate-orders'

    await this.knexConnection.table(this.tableName).del()

    let records = await this.knexConnection.table(aggregateTable).orderBy('id', 'asc').limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        records.map((r) => ({
          id: r.id,
          version: r.version,
          title: r.title,
          price: r.price,
          discount: r.discount,
          priority: r.priority,
          status: r.status,
          approved: r.approved,
          deleted_at: r.deleted_at
        }))
      )

      this.logger.info(`Applied orders from ${records[0].id} to ${records[records.length - 1].id}`)
      records = await this.knexConnection
        .table(aggregateTable)
        .where('id', '>', records[records.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Rebuild projection finished!')
  }
}
