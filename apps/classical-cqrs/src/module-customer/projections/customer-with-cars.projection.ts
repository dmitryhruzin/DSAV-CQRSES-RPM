import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import { EventStoreRepository } from '../../infra/event-store.repository.js'
import {
  CustomerWithCars,
  CustomerWithCarsDBUpdatePayload,
  CustomerWithCarsDBRecord,
  CustomerWithGroupedCarsDBRecord
} from '../../types/customer.js'
import { VersionMismatchError } from '../../types/common.js'
import { BaseProjection } from '../../infra/base.projection.js'

const mapPayloadToDbFormat = (payload: CustomerWithCarsDBUpdatePayload): CustomerWithCarsDBRecord => ({
  id: payload.id,
  customer_id: payload.customerID,
  user_id: payload.userID,
  first_name: payload.firstName,
  last_name: payload.lastName,
  phone_number: payload.phoneNumber,
  email: payload.email,
  customer_deleted_at: payload.customerDeletedAt,
  customer_version: payload.customerVersion,
  car_id: payload.carID,
  vin: payload.vin,
  registration_number: payload.registrationNumber,
  mileage: payload.mileage,
  car_deleted_at: payload.carDeletedAt,
  car_version: payload.carVersion
})

const mapPayloadFromDbFormat = (dbRecord: CustomerWithGroupedCarsDBRecord): CustomerWithCars => ({
  id: dbRecord.customer_id,
  userID: dbRecord.user_id,
  firstName: dbRecord.first_name,
  lastName: dbRecord.last_name,
  phoneNumber: dbRecord.phone_number,
  email: dbRecord.email,
  cars: dbRecord.cars.map((car: any) => ({
    id: car.car_id,
    vin: car.vin,
    registrationNumber: car.registration_number,
    mileage: car.mileage
  }))
})

@Injectable()
export class CustomerWithCarsProjection extends BaseProjection {
  constructor(
    private readonly eventStore: EventStoreRepository,
    @InjectConnection() readonly knexConnection: knex.Knex,
    @InjectLogger(CustomerWithCarsProjection.name) readonly logger: Logger
  ) {
    super(knexConnection, logger, 'customer-with-cars')
  }

  async onModuleInit() {
    if (!(await this.knexConnection.schema.hasTable(this.tableName))) {
      await this.knexConnection.schema.createTable(this.tableName, (table) => {
        table.string('id').primary()
        table.string('customer_id')
        table.string('user_id')
        table.string('first_name')
        table.string('last_name')
        table.string('email')
        table.string('phone_number')
        table.timestamp('customer_deleted_at')
        table.integer('customer_version')
        table.string('car_id')
        table.string('vin')
        table.string('registration_number')
        table.integer('mileage')
        table.timestamp('car_deleted_at')
        table.integer('car_version')
      })
      await this.knexConnection.schema.createTable(this.snapshotTableName, (table) => {
        table.string('id').primary()
        table.string('customer_id')
        table.string('user_id')
        table.string('first_name')
        table.string('last_name')
        table.string('email')
        table.string('phone_number')
        table.timestamp('customer_deleted_at')
        table.integer('customer_version')
        table.string('car_id')
        table.string('vin')
        table.string('registration_number')
        table.integer('mileage')
        table.timestamp('car_deleted_at')
        table.integer('car_version')
        table.integer('last_event_id')
      })
    }
  }

  async save(record: CustomerWithCarsDBUpdatePayload): Promise<boolean> {
    if (!record.id) {
      record.id = `${record.customerID}-${record.carID}`
    }
    await this.knexConnection.table(this.tableName).insert([mapPayloadToDbFormat(record)])

    return true
  }

  async updateCustomer(customerID: string, payload: CustomerWithCarsDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const records = await this.knexConnection
        .table(this.tableName)
        .transacting(trx)
        .forUpdate()
        .where({ customer_id: customerID })

      if (!records?.length) {
        await trx.commit()
        return true
      }

      if (records.some((r) => r.customer_version + 1 !== payload.customerVersion)) {
        throw new VersionMismatchError(
          `Version mismatch for Customer with id: ${customerID}, current versions: ${records.map((r) => r.customer_version).join(', ')}, new version: ${payload.customerVersion}`
        )
      }
      await this.knexConnection
        .table(this.tableName)
        .transacting(trx)
        .update(mapPayloadToDbFormat(payload))
        .where({ customer_id: customerID })
      await trx.commit()

      return true
    } catch (e) {
      await trx.rollback()

      if (e instanceof VersionMismatchError) {
        if (tryCounter < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return this.updateCustomer(customerID, payload, tryCounter + 1)
        } else {
          this.logger.warn(e)
          return true
        }
      }
      throw e
    }
  }

  async updateCar(carID: string, payload: CustomerWithCarsDBUpdatePayload, tryCounter = 0): Promise<boolean> {
    const trx = await this.knexConnection.transaction()
    try {
      const record = await this.knexConnection
        .table(this.tableName)
        .transacting(trx)
        .forUpdate()
        .where({ car_id: carID })
        .first()
      if (!record || record.car_version + 1 !== payload.carVersion) {
        throw new VersionMismatchError(
          `Version mismatch for Car with id: ${carID}, current version: ${record?.car_version}, new version: ${payload.carVersion}`
        )
      }
      await this.knexConnection
        .table(this.tableName)
        .transacting(trx)
        .update(mapPayloadToDbFormat(payload))
        .where({ car_id: carID })
      await trx.commit()

      return true
    } catch (e) {
      await trx.rollback()

      if (e instanceof VersionMismatchError) {
        if (tryCounter < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return this.updateCar(carID, payload, tryCounter + 1)
        } else {
          this.logger.warn(e)
          return true
        }
      }
      throw e
    }
  }

  async getByCustomerId(id: string): Promise<CustomerWithCars> {
    const record = await this.knexConnection
      .table(this.tableName)
      .select('customer_id', 'user_id', 'first_name', 'last_name', 'email', 'phone_number')
      .select(
        this.knexConnection.raw(`
          json_agg(
            json_build_object(
              'car_id', car_id,
              'vin', vin,
              'registration_number', registration_number,
              'mileage', mileage
            )
          ) as cars
        `)
      )
      .where({ customer_id: id })
      .whereNull('customer_deleted_at')
      .whereNull('car_deleted_at')
      .groupBy('customer_id', 'user_id', 'first_name', 'last_name', 'email', 'phone_number')
      .first()

    if (!record) {
      throw new Error(`Customer with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const eventNames = [
      'CarCreated',
      'CarOwnerChanged',
      'CarMileageRecorded',
      'CarDeleted',
      'CustomerRenamed',
      'CustomerContactsChanged',
      'CustomerDeleted'
    ]

    let lastEventID = await this.applySnapshot()
    let events = await this.eventStore.getEventsByName(eventNames, lastEventID)
    while (events.length > 0) {
      for (let i = 0; i < events.length; i += 1) {
        switch (events[i].name) {
          case 'CarCreated': {
            const {
              owner,
              id: carID,
              ownerID,
              ...carData
            } = events[i].body as {
              id: string
              ownerID: string
              vin: string
              registrationNumber: string
              mileage: number
              owner: {
                id: string
                userID: string
                firstName: string
                lastName: string
                email: string
                phoneNumber: string
                version: number
              }
            }
            const { version: customerVersion, id: customerID, ...ownerData } = owner || {}

            if (
              !carID ||
              !customerID ||
              !carData.vin ||
              !carData.registrationNumber ||
              !carData.mileage ||
              !ownerData.userID ||
              !ownerData.firstName ||
              !ownerData.lastName ||
              !customerVersion
            ) {
              this.logger.warn(`event with id: ${events[i].id} is missing some fields`)
              break
            }

            await this.save({
              ...carData,
              ...ownerData,
              carID,
              customerID: customerID || ownerID,
              customerVersion,
              carVersion: 1
            })
            break
          }
          case 'CarOwnerChanged': {
            const { owner } = events[i].body as {
              owner: { version: number; id: string; firstName: string; lastName: string; userID: string }
            }
            const { version: customerVersion, id: customerID, ...ownerData } = owner || {}
            if (!customerVersion || !customerID || !ownerData.firstName || !ownerData.lastName || !ownerData.userID) {
              this.logger.warn(`event with id: ${events[i].id} is missing some fields`)
              break
            }

            await this.updateCar(events[i].aggregateId, {
              ...ownerData,
              customerID,
              customerVersion,
              carVersion: events[i].aggregateVersion
            })

            break
          }
          case 'CarMileageRecorded': {
            const { mileage } = events[i].body as { mileage: number }
            if (!mileage) {
              this.logger.warn(`event with id: ${events[i].id} is missing mileage`)
              break
            }

            await this.updateCar(events[i].aggregateId, {
              mileage,
              carVersion: events[i].aggregateVersion
            })
            break
          }
          case 'CarDeleted': {
            const { deletedAt } = events[i].body as { deletedAt: Date }
            if (!deletedAt) {
              this.logger.warn(`event with id: ${events[i].id} is missing deletedAt`)
              break
            }

            await this.updateCar(events[i].aggregateId, {
              carDeletedAt: deletedAt,
              carVersion: events[i].aggregateVersion
            })
            break
          }
          case 'CustomerRenamed': {
            const { firstName, lastName } = events[i].body as { firstName: string; lastName: string }
            if (!firstName || !lastName) {
              this.logger.warn(`event with id: ${events[i].id} is missing firstName or lastName`)
              break
            }

            await this.updateCustomer(events[i].aggregateId, {
              firstName,
              lastName,
              customerVersion: events[i].aggregateVersion
            })
            break
          }
          case 'CustomerContactsChanged': {
            const { email, phoneNumber } = events[i].body as { email: string; phoneNumber: string }
            if (!email && !phoneNumber) {
              this.logger.warn(`event with id: ${events[i].id} is missing email and phoneNumber`)
              break
            }

            await this.updateCustomer(events[i].aggregateId, {
              email,
              phoneNumber,
              customerVersion: events[i].aggregateVersion
            })
            break
          }
          case 'CustomerDeleted': {
            const { deletedAt } = events[i].body as { deletedAt: Date }
            if (!deletedAt) {
              this.logger.warn(`event with id: ${events[i].id} is missing deletedAt`)
              break
            }

            await this.updateCustomer(events[i].aggregateId, {
              customerDeletedAt: deletedAt,
              customerVersion: events[i].aggregateVersion
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
