import { UserExitSystemCommandPayload } from '../../types/user.js'

export class UserExitSystemCommand {
  public readonly id: string

  constructor(public readonly payload: UserExitSystemCommandPayload) {
    this.id = payload.id
  }
}
