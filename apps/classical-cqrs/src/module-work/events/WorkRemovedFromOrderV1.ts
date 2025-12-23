import { WorkRemovedFromOrderV1EventPayload } from '../../types/work.js'
import { WorkRemovedFromOrder } from './WorkRemovedFromOrder.js'

export class WorkRemovedFromOrderV1 extends WorkRemovedFromOrder {
  public previousOrderID?: string
  public version: number = 1

  constructor(payload: WorkRemovedFromOrderV1EventPayload) {
    super(payload)

    this.previousOrderID = payload.previousOrderID
  }

  toJson() {
    return {
      previousOrderID: this.previousOrderID
    }
  }
}
