import { CreateUserCommandPayload } from '../../types/user.js'

export class CreateUserCommand {
  public readonly password: string

  constructor(public readonly payload: CreateUserCommandPayload) {
    this.password = payload.password
  }
}
