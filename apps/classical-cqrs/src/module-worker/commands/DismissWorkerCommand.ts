import { DismissWorkerCommandPayload } from '../../types/worker.js'

export class DismissWorkerCommand {
  public readonly id: string

  constructor(public readonly payload: DismissWorkerCommandPayload) {
    this.id = payload.id
  }
}
