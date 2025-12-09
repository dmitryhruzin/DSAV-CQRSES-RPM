import { ChangeUserPasswordCommandPayload } from '../../types/user.js'

export class ChangeUserPasswordCommand {
  public readonly id: string

  public readonly newPassword: string

  constructor(public readonly payload: ChangeUserPasswordCommandPayload) {
    this.id = payload.id
    this.newPassword = payload.newPassword
  }
}
