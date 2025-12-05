import { UserCreatedV1EventPayload } from '../../types/user.js'
import { UserCreated } from './UserCreated.js'

export class UserCreatedV1 extends UserCreated {
  public id: string

  public password: string

  public version: number = 1

  constructor(payload: UserCreatedV1EventPayload) {
    super(payload)

    this.id = payload.id
    this.password = payload.password
  }

  toJson() {
    return {
      id: this.id,
      password: this.password
    }
  }
}
