import { v4 } from 'uuid'
import { AggregateCustomerData } from '../types/customer.js'
import { Aggregate } from '../infra/aggregate.js'
import { CustomerCreatedV1, CustomerRenamedV1, CustomerContactsChangedV1, CustomerDeletedV1 } from './events/index.js'
import { CreateCustomerCommand, RenameCustomerCommand, ChangeCustomerContactsCommand } from './commands/index.js'
import CustomerValidator from './customer.validator.js'

export class CustomerAggregate extends Aggregate {
  private userID: string
  private firstName: string
  private lastName: string
  private email?: string
  private phoneNumber?: string
  private deletedAt?: Date

  constructor(data: AggregateCustomerData | null = null) {
    if (!data) {
      super()
    } else {
      super(data.id, data.version)

      this.userID = data.userID
      this.firstName = data.firstName
      this.lastName = data.lastName
      this.email = data.email
      this.phoneNumber = data.phoneNumber
      this.deletedAt = data.deletedAt
    }
  }

  create(command: CreateCustomerCommand) {
    this.id = v4()

    if (command.email && !CustomerValidator.isValidEmail(command.email)) {
      throw new Error('Invalid email')
    }
    if (command.phoneNumber && !CustomerValidator.isValidPhoneNumber(command.phoneNumber)) {
      throw new Error('Invalid phone number')
    }

    this.userID = command.userID
    this.firstName = command.firstName
    this.lastName = command.lastName
    this.email = command.email
    this.phoneNumber = command.phoneNumber
    this.version += 1

    const event = new CustomerCreatedV1({
      id: this.id,
      userID: command.userID,
      firstName: command.firstName,
      lastName: command.lastName,
      email: command.email,
      phoneNumber: command.phoneNumber,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  rename(command: RenameCustomerCommand) {
    const { firstName, lastName } = command

    this.version += 1

    const event = new CustomerRenamedV1({
      previousFirstName: this.firstName,
      previousLastName: this.lastName,
      firstName: firstName,
      lastName: lastName,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.firstName = firstName
    this.lastName = lastName

    this.apply(event)

    return [event]
  }

  changeContacts(command: ChangeCustomerContactsCommand) {
    const { email, phoneNumber } = command

    this.version += 1

    const event = new CustomerContactsChangedV1({
      previousEmail: this.email,
      previousPhoneNumber: this.phoneNumber,
      email: email,
      phoneNumber: phoneNumber,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.email = email
    this.phoneNumber = phoneNumber

    this.apply(event)

    return [event]
  }

  delete() {
    if (this.deletedAt) {
      throw new Error('Customer is already deleted')
    }

    this.version += 1
    this.deletedAt = new Date()

    const event = new CustomerDeletedV1({
      deletedAt: this.deletedAt,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  toJson(): AggregateCustomerData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      userID: this.userID,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      deletedAt: this.deletedAt
    }
  }
}
