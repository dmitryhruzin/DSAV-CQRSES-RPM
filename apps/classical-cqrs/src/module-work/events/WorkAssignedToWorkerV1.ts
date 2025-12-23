import { WorkAssignedToWorkerV1EventPayload } from '../../types/work.js'
import { WorkAssignedToWorker } from './WorkAssignedToWorker.js'

export class WorkAssignedToWorkerV1 extends WorkAssignedToWorker {
  public previousWorkerID?: string
  public workerID: string

  public version: number = 1

  constructor(payload: WorkAssignedToWorkerV1EventPayload) {
    super(payload)

    this.previousWorkerID = payload.previousWorkerID
    this.workerID = payload.workerID
  }

  toJson() {
    return {
      previousWorkerID: this.previousWorkerID,
      workerID: this.workerID
    }
  }
}
