import { OrderDiscountAppliedV1EventPayload } from '../../types/order.js'
import { OrderDiscountApplied } from './OrderDiscountApplied.js'

export class OrderDiscountAppliedV1 extends OrderDiscountApplied {
  public discount: string
  public previousDiscount?: string
  public version: number = 1

  constructor(payload: OrderDiscountAppliedV1EventPayload) {
    super(payload)

    this.discount = payload.discount
    this.previousDiscount = payload.previousDiscount
  }

  toJson() {
    return {
      previousDiscount: this.previousDiscount,
      discount: this.discount
    }
  }
}
