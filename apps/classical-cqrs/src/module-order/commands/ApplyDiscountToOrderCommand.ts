import { ApplyDiscountToOrderCommandPayload } from '../../types/order.js'

export class ApplyDiscountToOrderCommand {
  public readonly id: string
  public readonly discount: string

  constructor(public readonly payload: ApplyDiscountToOrderCommandPayload) {
    this.id = payload.id
    this.discount = payload.discount
  }
}
