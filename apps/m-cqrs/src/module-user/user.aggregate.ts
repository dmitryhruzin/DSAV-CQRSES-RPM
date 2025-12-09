import { v4 } from 'uuid'
import { AggregateUserData } from '../types/user.js'
import { Aggregate } from '../infra/aggregate.js'
import { UserCreatedV1, UserEnteredSystemV1, UserExitedSystemV1, UserPasswordChangedV1 } from './events/index.js'
import { CreateUserCommand, ChangeUserPasswordCommand } from './commands/index.js'
import UserValidator from './user.validator.js'

export class UserAggregate extends Aggregate {
  private password: string
  private isInSystem: boolean = false

  constructor(data: AggregateUserData | null = null) {
    if (!data) {
      super()
    } else {
      super(data.id, data.version)

      this.password = data.password || ''
    }
  }

  create(command: CreateUserCommand) {
    this.id = v4()

    if (!UserValidator.isValidPassword(command.password)) {
      throw new Error('Invalid password')
    }

    this.password = command.password

    this.version += 1

    const event = new UserCreatedV1({
      id: this.id,
      password: this.password,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  changePassword(command: ChangeUserPasswordCommand) {
    this.version += 1

    if (!UserValidator.isValidPassword(command.newPassword)) {
      throw new Error('Invalid password')
    }

    const event = new UserPasswordChangedV1({
      previousPassword: this.password,
      password: command.newPassword,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.password = command.newPassword

    this.apply(event)

    return [event]
  }

  enterSystem() {
    if (this.isInSystem) {
      throw new Error('User is already in the system')
    }

    this.version += 1
    this.isInSystem = true

    const event = new UserEnteredSystemV1({
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  exitSystem() {
    if (!this.isInSystem) {
      throw new Error('User is not in the system')
    }

    this.version += 1
    this.isInSystem = false

    const event = new UserExitedSystemV1({
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  toJson(): AggregateUserData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      password: this.password,
      isInSystem: this.isInSystem
    }
  }
}
