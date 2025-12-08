import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { UserMain, AggregateUserCreateData, AggregateUserUpdateData } from '../../types/user.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { BaseProjection } from '../../infra/base.projection.js'

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
        table.boolean('isinsystem')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('password')
        table.boolean('isinsystem')
        table.integer('version')
        table.integer('lastEventID')
      })
    }
  }

  async save(record: AggregateUserCreateData): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([{ ...record, version: 1 }])

    return true
  }

  mapPayloadToDbFormat(payload: AggregateUserUpdateData) {
    return { 
      ...payload,
      isinsystem: payload.isInSystem,
      isInSystem: undefined,
    }
  }

  mapPayloadFromDbFormat(dbRecord: any): UserMain {
    return {
      ...dbRecord,
      isInSystem: dbRecord.isinsystem,
      isinsystem: undefined,
    }
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
        .update(this.mapPayloadToDbFormat(payload))
        .where({ id })
      await trx.commit()

      return true
    } catch (e) {
      await trx.rollback()

      if (e instanceof VersionMismatchError) {
        if (tryCounter < 3) {
          setTimeout(() => this.update(id, payload, tryCounter + 1), 1000)
        } else {
          this.logger.warn(e)
        }
        return true
      }
      throw e
    }
  }

  async getAll(page: number, pageSize: number): Promise<Paginated<UserMain>> {
    const records = await this.knexConnection.table(this.tableName).select('id', 'password', 'isinsystem').limit(pageSize).offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(this.mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<UserMain> {
    const user = await this.knexConnection.table(this.tableName).select('id', 'password', 'isinsystem').where({ id }).first()

    if (!user) {
      throw new Error(`User with id: ${id} not found`)
    }

    return this.mapPayloadFromDbFormat(user)
  }

  async rebuild() {
    const eventNames = ['UserCreated']

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
            // eslint-disable-next-line no-await-in-loop
            await this.save({ id, password, isInSystem: false })
            break
          }
          case 'UserPasswordChanged': {
            const { password } = events[i].body as { password: string }
            if (!password) {
              this.logger.warn(`event with id: ${events[i].id} is missing password`)
              break
            }
            // eslint-disable-next-line no-await-in-loop
            await this.update(events[i].aggregateId, {
              password,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'UserEnteredSystem': {
            // eslint-disable-next-line no-await-in-loop
            await this.update(events[i].aggregateId, {
              isInSystem: true,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'UserExitedSystem': {
            // eslint-disable-next-line no-await-in-loop
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

      // eslint-disable-next-line no-await-in-loop
      events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    }

    await this.createSnapshot(lastEventID)

    this.logger.info('Rebuild projection finished!')
    return 0
  }
}
