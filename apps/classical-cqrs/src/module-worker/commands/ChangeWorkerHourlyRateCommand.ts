import { ChangeWorkerHourlyRateCommandPayload } from '../../types/worker.js'

export class ChangeWorkerHourlyRateCommand {
  public readonly id: string
  public readonly hourlyRate: string

  constructor(public readonly payload: ChangeWorkerHourlyRateCommandPayload) {
    this.id = payload.id
    this.hourlyRate = payload.hourlyRate
  }
}
