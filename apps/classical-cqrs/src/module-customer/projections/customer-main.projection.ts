import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { CustomerMain, CustomerMainDBUpdatePayload, CustomerMainDBRecord } from '../../types/customer.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: CustomerMainDBUpdatePayload): CustomerMainDBRecord => ({
  id: payload.id,
  userid: payload.userID,
  firstname: payload.firstName,
  lastname: payload.lastName,
  phonenumber: payload.phoneNumber,
  email: payload.email,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): CustomerMain => ({
  id: dbRecord.id,
  userID: dbRecord.userid,
  firstName: dbRecord.firstname,
  lastName: dbRecord.lastname,
  phoneNumber: dbRecord.phonenumber,
  email: dbRecord.email
})

@Injectable()
export class CustomerMainProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(CustomerMainProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'customers')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('userid')
        table.string('firstname')
        table.string('lastname')
        table.string('email')
        table.string('phonenumber')
        table.timestamp('deleted_at')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('userid')
        table.string('firstname')
        table.string('lastname')
        table.string('email')
        table.string('phonenumber')
        table.integer('version')
        table.timestamp('deleted_at')
        table.integer('last_event_id')
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
      .select('id', 'userid', 'firstname', 'lastname', 'email', 'phonenumber')
      .whereNull('deleted_at')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<CustomerMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'userid', 'firstname', 'lastname', 'email', 'phonenumber')
      .where({ id })
      .whereNull('deleted_at')
      .first()

    if (!record) {
      throw new Error(`Customer with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const eventNames = ['CustomerCreated', 'CustomerRenamed', 'CustomerContactsChanged', 'CustomerDeleted']

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'CustomerCreated': {
            const { id, userID, firstName, lastName, email, phoneNumber } = events[i].body as {
              id: string
              userID: string
              firstName: string
              lastName: string
              email: string
              phoneNumber: string
            }
            if (!id || !userID || !firstName || !lastName) {
              this.logger.warn(`event with id: ${events[i].id} is missing id, userID, firstName or lastName`)
              break
            }

            await this.save({ id, userID, firstName, lastName, email, phoneNumber, version: 1 })
            break
          }
          case 'CustomerRenamed': {
            const { firstName, lastName } = events[i].body as { firstName: string; lastName: string }
            if (!firstName && !lastName) {
              this.logger.warn(`event with id: ${events[i].id} is missing firstName and lastName`)
              break
            }

            await this.update(events[i].aggregateId, {
              firstName,
              lastName,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'CustomerContactsChanged': {
            const { email, phoneNumber } = events[i].body as { email: string; phoneNumber: string }
            if (!email && !phoneNumber) {
              this.logger.warn(`event with id: ${events[i].id} is missing email and phoneNumber`)
              break
            }

            await this.update(events[i].aggregateId, {
              email,
              phoneNumber,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'CustomerDeleted': {
            const { deletedAt } = events[i].body as { deletedAt: Date }
            if (!deletedAt) {
              this.logger.warn(`event with id: ${events[i].id} is missing deletedAt`)
              break
            }

            await this.update(events[i].aggregateId, {
              deletedAt,
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
