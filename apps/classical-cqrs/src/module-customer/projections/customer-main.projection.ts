import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import {
  CustomerMain,
  AggregateCustomerCreateData,
  AggregateCustomerData,
  CustomerMainDBRecord
} from '../../types/customer.js'
import { Paginated } from '../../types/common.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: AggregateCustomerData): CustomerMainDBRecord => ({
  id: payload.id,
  userid: payload.userID,
  firstname: payload.firstName,
  lastname: payload.lastName,
  phonenumber: payload.phoneNumber,
  email: payload.email,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): CustomerMain => ({
  ...dbRecord,
  isInSystem: dbRecord.isinsystem,
  isinsystem: undefined
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
        table.integer('lastEventID')
      })
    }
  }

  async save(record: AggregateCustomerCreateData): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat({ ...record, version: 1 })])

    return true
  }

  // async update(id: string, payload: AggregateCustomerUpdateData, tryCounter = 0): Promise<boolean> {
  //   const trx = await this.knexConnection.transaction()
  //   try {
  //     const user = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
  //     if (!user || user.version + 1 !== payload.version) {
  //       throw new VersionMismatchError(
  //         `Version mismatch for User with id: ${id}, current version: ${user?.version}, new version: ${payload.version}`
  //       )
  //     }
  //     await this.knexConnection
  //       .table(this.tableName)
  //       .transacting(trx)
  //       .update(mapPayloadToDbFormat(payload))
  //       .where({ id })
  //     await trx.commit()

  //     return true
  //   } catch (e) {
  //     await trx.rollback()

  //     if (e instanceof VersionMismatchError) {
  //       if (tryCounter < 3) {
  //         await new Promise((resolve) => setTimeout(resolve, 1000))
  //         return this.update(id, payload, tryCounter + 1)
  //       } else {
  //         this.logger.warn(e)
  //         return true
  //       }
  //     }
  //     throw e
  //   }
  // }

  async getAll(page: number, pageSize: number): Promise<Paginated<CustomerMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'userid', 'firstname', 'lastname', 'email', 'phonenumber')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<CustomerMain> {
    const user = await this.knexConnection
      .table(this.tableName)
      .select('id', 'userid', 'firstname', 'lastname', 'email', 'phonenumber')
      .where({ id })
      .first()

    if (!user) {
      throw new Error(`User with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(user)
  }

  async rebuild() {
    const eventNames = ['CustomerCreated']

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

            await this.save({ id, userID, firstName, lastName, email, phoneNumber })
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
