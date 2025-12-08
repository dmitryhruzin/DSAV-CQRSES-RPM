import { UserEnteredSystemV1EventPayload } from '../../types/user.js'
import { UserEnteredSystem } from './UserEnteredSystem.js'

export class UserEnteredSystemV1 extends UserEnteredSystem {
  public version: number = 1

  constructor(payload: UserEnteredSystemV1EventPayload) {
    super(payload)
  }

  toJson() {
    return {}
  }
}
