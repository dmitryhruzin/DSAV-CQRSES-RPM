import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { UserMain, UserMainDBRecord, UserMainDBUpdatePayload } from '../../types/user.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: UserMainDBUpdatePayload): UserMainDBRecord => ({
  id: payload.id,
  password: payload.password,
  is_in_system: payload.isInSystem,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): UserMain => ({
  id: dbRecord.id,
  password: dbRecord.password,
  isInSystem: dbRecord.is_in_system
})

@Injectable()
export class UserMainProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(UserMainProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'users')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('password')
        table.boolean('is_in_system')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('password')
        table.boolean('is_in_system')
        table.integer('version')
        table.integer('last_event_id')
      })
    }
  }

  async save(record: UserMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: UserMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
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
          return this.update(id, payload, tryCounter + 1)
        } else {
          this.logger.warn(e)
          return true
        }
      }
      throw e
    }
  }

  async getAll(page: number, pageSize: number): Promise<Paginated<UserMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'password', 'is_in_system')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<UserMain> {
    const user = await this.knexConnection
      .table(this.tableName)
      .select('id', 'password', 'is_in_system')
      .where({ id })
      .first()

    if (!user) {
      throw new Error(`User with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(user)
  }

  async rebuild() {
    const eventNames = ['UserCreated', 'UserPasswordChanged', 'UserEnteredSystem', 'UserExitedSystem']

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'UserCreated': {
            const { id, password } = events[i].body as { id: string; password: string }
            if (!id || !password) {
              this.logger.warn(`event with id: ${events[i].id} is missing id or password`)
              break
            }

            await this.save({ id, password, isInSystem: false, version: 1 })
            break
          }
          case 'UserPasswordChanged': {
            const { password } = events[i].body as { password: string }
            if (!password) {
              this.logger.warn(`event with id: ${events[i].id} is missing password`)
              break
            }

            await this.update(events[i].aggregateId, {
              password,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'UserEnteredSystem': {
            await this.update(events[i].aggregateId, {
              isInSystem: true,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'UserExitedSystem': {
            await this.update(events[i].aggregateId, {
              isInSystem: false,
              version: events[i].aggregateVersion
            })
            break
          }
          default: {
            break
          }
        }
      }
      lastEventID = events[events.length - 1].id
      this.logger.info(`Applied events from ${events[0].id} to ${lastEventID}`)

      events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    }

    await this.createSnapshot(lastEventID)

    this.logger.info('Rebuild projection finished!')
    return 0
  }
}
