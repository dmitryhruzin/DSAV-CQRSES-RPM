import { WorkUnassignedFromWorkerV1EventPayload } from '../../types/work.js'
import { WorkUnassignedFromWorker } from './WorkUnassignedFromWorker.js'

export class WorkUnassignedFromWorkerV1 extends WorkUnassignedFromWorker {
  public previousWorkerID?: string

  public version: number = 1

  constructor(payload: WorkUnassignedFromWorkerV1EventPayload) {
    super(payload)

    this.previousWorkerID = payload.previousWorkerID
  }

  toJson() {
    return {
      previousWorkerID: this.previousWorkerID
    }
  }
}
