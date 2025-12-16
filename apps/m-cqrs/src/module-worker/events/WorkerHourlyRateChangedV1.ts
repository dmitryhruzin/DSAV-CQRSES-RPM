import { WorkerHourlyRateChangedV1EventPayload } from '../../types/worker.js'
import { WorkerHourlyRateChanged } from './WorkerHourlyRateChanged.js'

export class WorkerHourlyRateChangedV1 extends WorkerHourlyRateChanged {
  public hourlyRate: string
  public previousHourlyRate: string
  public version: number = 1

  constructor(payload: WorkerHourlyRateChangedV1EventPayload) {
    super(payload)

    this.hourlyRate = payload.hourlyRate
    this.previousHourlyRate = payload.previousHourlyRate
  }

  toJson() {
    return {
      previousHourlyRate: this.previousHourlyRate,
      hourlyRate: this.hourlyRate
    }
  }
}
