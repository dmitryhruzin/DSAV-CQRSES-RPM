import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { AggregateUserCreateData, AggregateUserUpdateData, UserMain } from '../../types/user.js'
import { VersionMismatchError, Paginated } from '../../types/common.js'

const mapPayloadToDbFormat = (payload: AggregateUserUpdateData) => ({
  ...payload,
  isinsystem: payload.isInSystem,
  isInSystem: undefined
})

const mapPayloadFromDbFormat = (dbRecord: any): UserMain => ({
  ...dbRecord,
  isInSystem: dbRecord.isinsystem,
  isinsystem: undefined
})

@Injectable()
export class UserMainProjection {
  private tableName: string = 'users'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(UserMainProjection.name) private readonly logger: Logger
  ) {}

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('password')
        table.boolean('isinsystem')
        table.integer('version')
      })
    }
  }

  async save(record: AggregateUserCreateData): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([{ ...record, version: 1 }])

    return true
  }

  async update(id: string, payload: AggregateUserUpdateData, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const user = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!user || user.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for User with id: ${id}, current version: ${user?.version}, new version: ${payload.version}`
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
          await this.update(id, payload, tryCounter + 1)
        } else {
          this.logger.warn(e)
        }
        return true
      }
      throw e
    }
  }

  async getAll(page: number, pageSize: number): Promise<Paginated<UserMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'password', 'isinsystem')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<UserMain> {
    const user = await this.knexConnection
      .table(this.tableName)
      .select('id', 'password', 'isinsystem')
      .where({ id })
      .first()

    if (!user) {
      throw new Error(`User with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(user)
  }

  async rebuild() {
    const aggregateTable = 'aggregate-users'

    await this.knexConnection.table(this.tableName).del()

    let users = await this.knexConnection.table(aggregateTable).orderBy('id', 'asc').limit(100)

    while (users.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        users.map((u) => ({
          id: u.id,
          password: u.password,
          version: u.version
        }))
      )

      this.logger.info(`Applied users from ${users[0].id} to ${users[users.length - 1].id}`)

      users = await this.knexConnection
        .table(aggregateTable)
        .where('id', '>', users[users.length - 1].id)
        .orderBy('id', 'asc')
        .limit(100)
    }

    this.logger.info('Rebuild projection finished!')
  }
}
