import { HireWorkerCommandPayload } from '../../types/worker.js'

export class HireWorkerCommand {
  public readonly hourlyRate: string
  public readonly role: string

  constructor(public readonly payload: HireWorkerCommandPayload) {
    this.hourlyRate = payload.hourlyRate
    this.role = payload.role
  }
}
