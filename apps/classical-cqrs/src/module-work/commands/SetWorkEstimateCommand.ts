import { SetWorkEstimateCommandPayload } from '../../types/work.js'

export class SetWorkEstimateCommand {
  public readonly id: string
  public readonly estimate: string

  constructor(public readonly payload: SetWorkEstimateCommandPayload) {
    this.id = payload.id
    this.estimate = payload.estimate
  }
}
