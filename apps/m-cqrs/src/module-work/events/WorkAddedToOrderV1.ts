import { WorkAddedToOrderV1EventPayload } from '../../types/work.js'
import { WorkAddedToOrder } from './WorkAddedToOrder.js'

export class WorkAddedToOrderV1 extends WorkAddedToOrder {
  public previousOrderID?: string
  public orderID: string
  public version: number = 1

  constructor(payload: WorkAddedToOrderV1EventPayload) {
    super(payload)

    this.previousOrderID = payload.previousOrderID
    this.orderID = payload.orderID
  }

  toJson() {
    return {
      previousOrderID: this.previousOrderID,
      orderID: this.orderID
    }
  }
}
