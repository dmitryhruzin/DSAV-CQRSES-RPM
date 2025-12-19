import { ChangeOrderPriceCommandPayload } from '../../types/order.js'

export class ChangeOrderPriceCommand {
  public readonly id: string
  public readonly price: string

  constructor(public readonly payload: ChangeOrderPriceCommandPayload) {
    this.id = payload.id
    this.price = payload.price
  }
}
