import { UserEnterSystemCommandPayload } from '../../types/user.js'

export class UserEnterSystemCommand {
  public readonly id: string

  constructor(public readonly payload: UserEnterSystemCommandPayload) {
    this.id = payload.id
  }
}
