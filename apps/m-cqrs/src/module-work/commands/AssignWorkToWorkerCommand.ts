import { AssignWorkToWorkerCommandPayload } from '../../types/work.js'

export class AssignWorkToWorkerCommand {
  public readonly id: string
  public readonly workerID: string

  constructor(public readonly payload: AssignWorkToWorkerCommandPayload) {
    this.id = payload.id
    this.workerID = payload.workerID
  }
}
