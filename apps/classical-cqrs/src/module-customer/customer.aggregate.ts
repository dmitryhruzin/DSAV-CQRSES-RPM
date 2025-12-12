import { v4 } from 'uuid'
import { AggregateCustomerData } from '../types/customer.js'
import { Aggregate } from '../infra/aggregate.js'
import { CustomerCreatedV1, CustomerRenamedV1 } from './events/index.js'
import { CreateCustomerCommand, RenameCustomerCommand } from './commands/index.js'
import { Snapshot } from '../types/common.js'
import CustomerValidator from './customer.validator.js'

export class CustomerAggregate extends Aggregate {
  private userID: string
  private firstName: string
  private lastName: string
  private email?: string
  private phoneNumber?: string

  constructor(snapshot: Snapshot<CustomerAggregate> = null) {
    if (!snapshot) {
      super()
    } else {
      super(snapshot.aggregateId, snapshot.aggregateVersion)

      if (snapshot.state) {
        this.userID = snapshot.state.userID
        this.firstName = snapshot.state.firstName
        this.lastName = snapshot.state.lastName
        this.email = snapshot.state.email
        this.phoneNumber = snapshot.state.phoneNumber
      }
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

  replayCustomerCreatedV1(event: CustomerCreatedV1) {
    this.id = event.id
    this.userID = event.userID
    this.firstName = event.firstName
    this.lastName = event.lastName
    this.email = event.email
    this.phoneNumber = event.phoneNumber

    this.version += 1
  }

  rename(command: RenameCustomerCommand) {
    const { firstName, lastName } = command

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
    this.version += 1

    this.apply(event)

    return [event]
  }

  replayCustomerRenamedV1(event: CustomerRenamedV1) {
    this.firstName = event.firstName
    this.lastName = event.lastName

    this.version += 1
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
      phoneNumber: this.phoneNumber
    }
  }
}
