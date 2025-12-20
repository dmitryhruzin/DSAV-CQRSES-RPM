import { OrderPrioritySetV1EventPayload } from '../../types/order.js'
import { OrderPrioritySet } from './OrderPrioritySet.js'

export class OrderPrioritySetV1 extends OrderPrioritySet {
  public priority: number
  public previousPriority?: number
  public version: number = 1

  constructor(payload: OrderPrioritySetV1EventPayload) {
    super(payload)

    this.priority = payload.priority
    this.previousPriority = payload.previousPriority
  }

  toJson() {
    return {
      previousPriority: this.previousPriority,
      priority: this.priority
    }
  }
}
