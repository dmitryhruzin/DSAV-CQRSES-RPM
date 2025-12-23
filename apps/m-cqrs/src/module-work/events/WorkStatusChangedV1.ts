import { WorkStatusChangedV1EventPayload } from '../../types/work.js'
import { WorkStatusChanged } from './WorkStatusChanged.js'

export class WorkStatusChangedV1 extends WorkStatusChanged {
  public previousStatus?: string
  public status: string

  public version: number = 1

  constructor(payload: WorkStatusChangedV1EventPayload) {
    super(payload)

    this.previousStatus = payload.previousStatus
    this.status = payload.status
  }

  toJson() {
    return {
      previousStatus: this.previousStatus,
      status: this.status
    }
  }
}
