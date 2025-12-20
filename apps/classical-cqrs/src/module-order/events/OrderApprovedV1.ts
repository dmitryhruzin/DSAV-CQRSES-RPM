import { OrderApprovedV1EventPayload } from '../../types/order.js'
import { OrderApproved } from './OrderApproved.js'

export class OrderApprovedV1 extends OrderApproved {
  public version: number = 1

  constructor(payload: OrderApprovedV1EventPayload) {
    super(payload)
  }

  toJson() {
    return {}
  }
}
