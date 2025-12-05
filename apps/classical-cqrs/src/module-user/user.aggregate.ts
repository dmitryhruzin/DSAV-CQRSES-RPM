import { v4 } from 'uuid'
import { AggregateUserData } from '../types/user.js'
import { Aggregate } from '../infra/aggregate-module/aggregate.js'
import { UserCreatedV1, UserPasswordChangedV1 } from './events/index.js'
import { CreateUserCommand, ChangeUserPasswordCommand } from './commands/index.js'
import { Snapshot } from '../types/common.js'
import UserValidator from './user.validator.js'

export class UserAggregate extends Aggregate {
  private password: string

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

  toJson(): AggregateUserData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      password: this.password
    }
  }
}
