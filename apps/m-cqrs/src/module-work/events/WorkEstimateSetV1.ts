import { WorkEstimateSetV1EventPayload } from '../../types/work.js'
import { WorkEstimateSet } from './WorkEstimateSet.js'

export class WorkEstimateSetV1 extends WorkEstimateSet {
  public previousEstimate?: string
  public estimate?: string

  public version: number = 1

  constructor(payload: WorkEstimateSetV1EventPayload) {
    super(payload)

    this.previousEstimate = payload.previousEstimate
    this.estimate = payload.estimate
  }

  toJson() {
    return {
      previousEstimate: this.previousEstimate,
      estimate: this.estimate
    }
  }
}
