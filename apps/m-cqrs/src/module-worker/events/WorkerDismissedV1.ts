import { WorkerDismissedV1EventPayload } from '../../types/worker.js'
import { WorkerDismissed } from './WorkerDismissed.js'

export class WorkerDismissedV1 extends WorkerDismissed {
  public deletedAt: Date

  public version: number = 1

  constructor(payload: WorkerDismissedV1EventPayload) {
    super(payload)

    this.deletedAt = payload.deletedAt
  }

  toJson() {
    return {
      deletedAt: this.deletedAt
    }
  }
}
