import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import { CarMain, CarMainDBUpdatePayload, CarMainDBRecord } from '../../types/car.js'
import { Paginated, VersionMismatchError } from '../../types/common.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: CarMainDBUpdatePayload): CarMainDBRecord => ({
  id: payload.id,
  owner_id: payload.ownerID,
  vin: payload.vin,
  registration_number: payload.registrationNumber,
  mileage: payload.mileage,
  deleted_at: payload.deletedAt,
  version: payload.version
})

const mapPayloadFromDbFormat = (dbRecord: any): CarMain => ({
  id: dbRecord.id,
  ownerID: dbRecord.owner_id,
  vin: dbRecord.vin,
  registrationNumber: dbRecord.registration_number,
  mileage: dbRecord.mileage
})

@Injectable()
export class CarMainProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(CarMainProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'cars')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('owner_id')
        table.string('vin')
        table.string('registration_number')
        table.integer('mileage')
        table.timestamp('deleted_at')
        table.integer('version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('owner_id')
        table.string('vin')
        table.string('registration_number')
        table.integer('mileage')
        table.timestamp('deleted_at')
        table.integer('version')
        table.integer('last_event_id')
      })
    }
  }

  async save(record: CarMainDBUpdatePayload): Promise<boolean> {
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async update(id: string, payload: CarMainDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection.table(this.tableName).transacting(trx).forUpdate().where({ id }).first()
      if (!record || record.version + 1 !== payload.version) {
        throw new VersionMismatchError(
          `Version mismatch for Car with id: ${id}, current version: ${record?.version}, new version: ${payload.version}`
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

  async getAll(page: number, pageSize: number): Promise<Paginated<CarMain>> {
    const records = await this.knexConnection
      .table(this.tableName)
      .select('id', 'owner_id', 'vin', 'registration_number', 'mileage')
      .whereNull('deleted_at')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = await this.knexConnection.table(this.tableName).count<{ count: number }[]>('* as count').first()
    return { items: records.map(mapPayloadFromDbFormat), page, pageSize, total: total?.count || 0 }
  }

  async getById(id: string): Promise<CarMain> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('id', 'owner_id', 'vin', 'registration_number', 'mileage')
      .where({ id })
      .whereNull('deleted_at')
      .first()

    if (!record) {
      throw new Error(`Car with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const eventNames = ['CarCreated', 'CarOwnerChanged', 'CarMileageRecorded', 'CarDeleted']

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'CarCreated': {
            const { id, ownerID, vin, registrationNumber, mileage } = events[i].body as {
              id: string
              ownerID: string
              vin: string
              registrationNumber: string
              mileage: number
            }
            if (!id || !ownerID || !vin || !registrationNumber || mileage === undefined) {
              this.logger.warn(
                `event with id: ${events[i].id} is missing id, ownerID, vin, registrationNumber or mileage`
              )
              break
            }

            await this.save({ id, ownerID, vin, registrationNumber, mileage, version: 1 })
            break
          }
          case 'CarOwnerChanged': {
            const { ownerID } = events[i].body as { ownerID: string }
            if (!ownerID) {
              this.logger.warn(`event with id: ${events[i].id} is missing ownerID`)
              break
            }

            await this.update(events[i].aggregateId, {
              ownerID,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'CarMileageRecorded': {
            const { mileage } = events[i].body as { mileage: number }
            if (mileage === undefined) {
              this.logger.warn(`event with id: ${events[i].id} is missing mileage`)
              break
            }

            await this.update(events[i].aggregateId, {
              mileage,
              version: events[i].aggregateVersion
            })
            break
          }
          case 'CarDeleted': {
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
