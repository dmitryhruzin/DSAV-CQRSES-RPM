import knex from 'knex'
import { Injectable } from '@nestjs/common'
import { InjectConnection } from 'nest-knexjs'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'
import {
  CustomerWithCars,
  CustomerWithCarsDBUpdatePayload,
  CustomerWithCarsDBRecord,
  CustomerWithGroupedCarsDBRecord
} from '../../types/customer.js'
import { VersionMismatchError } from '../../types/common.js'

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
export class CustomerWithCarsProjection {
  private tableName: string = 'customer-with-cars'

  constructor(
    @InjectConnection() private readonly knexConnection: knex.Knex,
    @InjectLogger(CustomerWithCarsProjection.name) private readonly logger: Logger
  ) {}

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
      .whereNull('car_deleted_at')
      .groupBy('customer_id', 'user_id', 'first_name', 'last_name', 'email', 'phone_number')
      .first()

    if (!record) {
      throw new Error(`Customer with id: ${id} not found`)
    }

    return mapPayloadFromDbFormat(record)
  }

  async rebuild() {
    const carsAggregateTable = 'aggregate-cars'
    const customersAggregateTable = 'aggregate-customers'

    await this.knexConnection.table(this.tableName).del()

    let records = await this.knexConnection
      .table(carsAggregateTable)
      .orderBy(`${carsAggregateTable}.id`, 'asc')
      .join(customersAggregateTable, `${carsAggregateTable}.owner_id`, `${customersAggregateTable}.id`)
      .select(
        `${carsAggregateTable}.id as car_id`,
        `${carsAggregateTable}.vin as vin`,
        `${carsAggregateTable}.registration_number as registration_number`,
        `${carsAggregateTable}.mileage as mileage`,
        `${carsAggregateTable}.deleted_at as car_deleted_at`,
        `${carsAggregateTable}.version as car_version`,
        `${customersAggregateTable}.id as customer_id`,
        `${customersAggregateTable}.user_id as user_id`,
        `${customersAggregateTable}.first_name as first_name`,
        `${customersAggregateTable}.last_name as last_name`,
        `${customersAggregateTable}.email as email`,
        `${customersAggregateTable}.phone_number as phone_number`,
        `${customersAggregateTable}.deleted_at as customer_deleted_at`,
        `${customersAggregateTable}.version as customer_version`
      )
      .limit(100)

    while (records.length > 0) {
      await this.knexConnection.table(this.tableName).insert(
        records.map((r) => ({
          id: `${r.customer_id}-${r.car_id}`,
          customer_id: r.customer_id,
          user_id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          phone_number: r.phone_number,
          email: r.email,
          customer_deleted_at: r.customer_deleted_at,
          customer_version: r.customer_version,
          car_id: r.car_id,
          vin: r.vin,
          registration_number: r.registration_number,
          mileage: r.mileage,
          car_deleted_at: r.car_deleted_at,
          car_version: r.car_version
        }))
      )

      this.logger.info(`Applied customers from ${records[0].id} to ${records[records.length - 1].id}`)
      records = await this.knexConnection
        .table(carsAggregateTable)
        .where(`${carsAggregateTable}.id`, '>', records[records.length - 1].id)
        .orderBy(`${carsAggregateTable}.id`, 'asc')
        .join(customersAggregateTable, `${carsAggregateTable}.owner_id`, `${customersAggregateTable}.id`)
        .select(
          `${carsAggregateTable}.id as car_id`,
          `${carsAggregateTable}.vin as vin`,
          `${carsAggregateTable}.registration_number as registration_number`,
          `${carsAggregateTable}.mileage as mileage`,
          `${carsAggregateTable}.deleted_at as car_deleted_at`,
          `${carsAggregateTable}.version as car_version`,
          `${customersAggregateTable}.id as customer_id`,
          `${customersAggregateTable}.user_id as user_id`,
          `${customersAggregateTable}.first_name as first_name`,
          `${customersAggregateTable}.last_name as last_name`,
          `${customersAggregateTable}.email as email`,
          `${customersAggregateTable}.phone_number as phone_number`,
          `${customersAggregateTable}.deleted_at as customer_deleted_at`,
          `${customersAggregateTable}.version as customer_version`
        )
        .limit(100)
    }

    this.logger.info('Rebuild projection finished!')
  }
}
