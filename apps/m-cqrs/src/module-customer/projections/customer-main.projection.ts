import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { CustomerMain, CustomerMainDBUpdatePayload, CustomerMainDBRecord } from '../../types/customer.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'

const mapPayloadToDbFormat = (payload: CustomerMainDBUpdatePayload): CustomerMainDBRecord => ({
  id: payload.id,
  user_id: payload.userID,
  first_name: payload.firstName,
  last_name: payload.lastName,
  phone_number: payload.phoneNumber,
  email: payload.email,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): CustomerMain => ({
  id: dbRecord.id,
  userID: dbRecord.user_id,
  firstName: dbRecord.first_name,
  lastName: dbRecord.last_name,
  phoneNumber: dbRecord.phone_number,
  email: dbRecord.email
})

@Injectable()
export class CustomerMainProjection {
  private tableName: string = 'customers'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(CustomerMainProjection.name) private readonly logger: Logger
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('user_id')
        table.string('first_name')
        table.string('last_name')
        table.string('email')
        table.string('phone_number')
        table.timestamp('deleted_at')
        table.integer('version')
      })
    }
  }

  async save(record: CustomerMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: CustomerMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Customer with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
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

  async getAll(page: number, pageSize: number): Promise<Paginated<CustomerMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'user_id', 'first_name', 'last_name', 'email', 'phone_number')
      .whereNull('deleted_at')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<CustomerMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'user_id', 'first_name', 'last_name', 'email', 'phone_number')
      .where({ id })
      .whereNull('deleted_at')
      .first()

    if (!record) {
      throw new Error(`Customer with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const aggregateTable = 'aggregate-customers'

    await this.knexConnection.table(this.tableName).del()

    let records = await this.knexConnection.table(aggregateTable).orderBy('id', 'asc').limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        records.map((r) => ({
          id: r.id,
          version: r.version,
          user_id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          phone_number: r.phone_number,
          deleted_at: r.deleted_at
        }))
      )

      this.logger.info(`Applied customers from ${records[0].id} to ${records[records.length - 1].id}`)
      records = await this.knexConnection
        .table(aggregateTable)
        .where('id', '>', records[records.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Rebuild projection finished!')
  }
}
