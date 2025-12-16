import { WorkerHiredV1EventPayload } from '../../types/worker.js'
import { WorkerHired } from './WorkerHired.js'

export class WorkerHiredV1 extends WorkerHired {
  public id: string
  public hourlyRate: string
  public role: string

  public version: number = 1

  constructor(payload: WorkerHiredV1EventPayload) {
    super(payload)

    this.id = payload.id
    this.hourlyRate = payload.hourlyRate
    this.role = payload.role
  }

  toJson() {
    return {
      id: this.id,
      hourlyRate: this.hourlyRate,
      role: this.role
    }
  }
}
