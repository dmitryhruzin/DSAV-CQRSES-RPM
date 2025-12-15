import { v4 } from 'uuid'
import { AggregateCarData } from '../types/car.js'
import { Aggregate } from '../infra/aggregate.js'
import { CreateCarCommand, RecordCarMileageCommand, ChangeCarOwnerCommand } from './commands/index.js'
import { CarCreatedV1, CarMileageRecordedV1, CarOwnerChangedV1, CarDeletedV1 } from './events/index.js'
import CarValidator from './car.validator.js'

export class CarAggregate extends Aggregate {
  private ownerID: string
  private vin: string
  private registrationNumber: string
  private mileage: number
  private deletedAt?: Date

  constructor(data: AggregateCarData | null = null) {
    if (!data) {
      super()
    } else {
      super(data.id, data.version)

      this.ownerID = data.ownerID
      this.vin = data.vin
      this.registrationNumber = data.registrationNumber
      this.mileage = data.mileage
      this.deletedAt = data.deletedAt
    }
  }

  create(command: CreateCarCommand) {
    this.id = v4()

    if (command.mileage && !CarValidator.isValidMileage(command.mileage)) {
      throw new Error('Invalid mileage')
    }
    if (command.vin && !CarValidator.isValidVin(command.vin)) {
      throw new Error('Invalid VIN')
    }
    if (command.registrationNumber && !CarValidator.isValidRegistrationNumber(command.registrationNumber)) {
      throw new Error('Invalid registration number')
    }

    this.ownerID = command.ownerID
    this.vin = command.vin
    this.registrationNumber = command.registrationNumber
    this.mileage = command.mileage
    this.version += 1

    const event = new CarCreatedV1({
      id: this.id,
      ownerID: command.ownerID,
      vin: command.vin,
      registrationNumber: command.registrationNumber,
      mileage: command.mileage,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  recordMileage(command: RecordCarMileageCommand) {
    const { mileage } = command

    if (command.mileage && !CarValidator.isValidMileage(mileage)) {
      throw new Error('Invalid mileage')
    }

    this.version += 1

    const event = new CarMileageRecordedV1({
      previousMileage: this.mileage,
      mileage: mileage,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.mileage = mileage

    this.apply(event)

    return [event]
  }

  changeOwner(command: ChangeCarOwnerCommand) {
    const { ownerID } = command

    this.version += 1

    const event = new CarOwnerChangedV1({
      previousOwnerID: this.ownerID,
      ownerID: ownerID,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.ownerID = ownerID

    this.apply(event)

    return [event]
  }

  delete() {
    if (this.deletedAt) {
      throw new Error('Car is already deleted')
    }

    this.version += 1
    this.deletedAt = new Date()

    const event = new CarDeletedV1({
      deletedAt: this.deletedAt,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    console.log('Car deleted at:', this.deletedAt)
    this.apply(event)

    return [event]
  }

  toJson(): AggregateCarData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      ownerID: this.ownerID,
      vin: this.vin,
      registrationNumber: this.registrationNumber,
      mileage: this.mileage,
      deletedAt: this.deletedAt
    }
  }
}
