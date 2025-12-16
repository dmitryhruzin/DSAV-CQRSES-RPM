import { WorkerRoleChangedV1EventPayload } from '../../types/worker.js'
import { WorkerRoleChanged } from './WorkerRoleChanged.js'

export class WorkerRoleChangedV1 extends WorkerRoleChanged {
  public previousRole: string
  public role: string

  public version: number = 1

  constructor(payload: WorkerRoleChangedV1EventPayload) {
    super(payload)

    this.previousRole = payload.previousRole
    this.role = payload.role
  }

  toJson() {
    return {
      previousRole: this.previousRole,
      role: this.role
    }
  }
}
