import { UserPasswordChangedV1EventPayload } from '../../types/user.js'
import { UserPasswordChanged } from './UserPasswordChanged.js'

export class UserPasswordChangedV1 extends UserPasswordChanged {
  public previousPassword: string

  public password: string

  public version: number = 1

  constructor(payload: UserPasswordChangedV1EventPayload) {
    super(payload)

    this.previousPassword = payload.previousPassword
    this.password = payload.password
  }

  toJson() {
    return {
      previousPassword: this.previousPassword,
      password: this.password
    }
  }
}
