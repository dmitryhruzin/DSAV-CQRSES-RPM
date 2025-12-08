import { v4 } from 'uuid'
import { AggregateUserData } from '../types/user.js'
import { Aggregate } from '../infra/aggregate.js'
import { UserCreatedV1, UserPasswordChangedV1, UserEnteredSystemV1, UserExitedSystemV1 } from './events/index.js'
import { CreateUserCommand, ChangeUserPasswordCommand } from './commands/index.js'
import { Snapshot } from '../types/common.js'
import UserValidator from './user.validator.js'

export class UserAggregate extends Aggregate {
  private password: string
  private isInSystem: boolean = false

  constructor(snapshot: Snapshot<UserAggregate> = null) {
    if (!snapshot) {
      super()
    } else {
      super(snapshot.aggregateId, snapshot.aggregateVersion)

      if (snapshot.state) {
        this.password = snapshot.state.password
      }
    }
  }

  create(command: CreateUserCommand) {
    this.id = v4()

    if (!UserValidator.isValidPassword(command.password)) {
      throw new Error('Invalid password')
    }

    this.password = command.password

    const event = new UserCreatedV1({
      id: this.id,
      password: command.password,
      aggregateId: this.id,
      aggregateVersion: this.version + 1
    })

    this.apply(event)

    return [event]
  }

  replayUserCreatedV1(event: UserCreatedV1) {
    this.id = event.id
    this.password = event.password

    this.version += 1
  }

  changePassword(command: ChangeUserPasswordCommand) {
    const { newPassword } = command

    if (!UserValidator.isValidPassword(newPassword)) {
      throw new Error('Invalid password')
    }

    this.password = newPassword

    const event = new UserPasswordChangedV1({
      previousPassword: this.password,
      password: newPassword,
      aggregateId: this.id,
      aggregateVersion: this.version + 1
    })

    this.apply(event)

    return [event]
  }

  replayUserPasswordChangedV1(event: UserPasswordChangedV1) {
    this.password = event.password

    this.version += 1
  }

  enterSystem() {
    if (this.isInSystem) {
      throw new Error('User is already in the system')
    }

    this.isInSystem = true

    const event = new UserEnteredSystemV1({
      aggregateId: this.id,
      aggregateVersion: this.version + 1
    })

    this.apply(event)

    return [event]
  }

  replayUserEnteredSystemV1() {
    this.isInSystem = true

    this.version += 1
  }

  exitSystem() {
    if (!this.isInSystem) {
      throw new Error('User is not in the system')
    }

    this.isInSystem = false

    const event = new UserExitedSystemV1({
      aggregateId: this.id,
      aggregateVersion: this.version + 1
    })

    this.apply(event)

    return [event]
  }

  replayUserExitedSystemV1() {
    this.isInSystem = false

    this.version += 1
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
