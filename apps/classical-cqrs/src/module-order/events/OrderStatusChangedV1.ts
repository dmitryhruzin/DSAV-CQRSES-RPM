import { OrderStatusChangedV1EventPayload } from '../../types/order.js'
import { OrderStatusChanged } from './OrderStatusChanged.js'

export class OrderStatusChangedV1 extends OrderStatusChanged {
  public status: string
  public previousStatus: string
  public version: number = 1

  constructor(payload: OrderStatusChangedV1EventPayload) {
    super(payload)

    this.status = payload.status
    this.previousStatus = payload.previousStatus
  }

  toJson() {
    return {
      previousStatus: this.previousStatus,
      status: this.status
    }
  }
}
