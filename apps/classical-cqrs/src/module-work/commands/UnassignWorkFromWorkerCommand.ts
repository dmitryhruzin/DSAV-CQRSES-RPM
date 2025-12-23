import { UnassignWorkFromWorkerCommandPayload } from '../../types/work.js'

export class UnassignWorkFromWorkerCommand {
  public readonly id: string

  constructor(public readonly payload: UnassignWorkFromWorkerCommandPayload) {
    this.id = payload.id
  }
}
