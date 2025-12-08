import { UserExitedSystemV1EventPayload } from '../../types/user.js'
import { UserExitedSystem } from './UserExitedSystem.js'

export class UserExitedSystemV1 extends UserExitedSystem {
  public version: number = 1

  constructor(payload: UserExitedSystemV1EventPayload) {
    super(payload)
  }

  toJson() {
    return {}
  }
}
