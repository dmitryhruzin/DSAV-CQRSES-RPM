import { OrderPriceChangedV1EventPayload } from '../../types/order.js'
import { OrderPriceChanged } from './OrderPriceChanged.js'

export class OrderPriceChangedV1 extends OrderPriceChanged {
  public price: string
  public previousPrice: string
  public version: number = 1

  constructor(payload: OrderPriceChangedV1EventPayload) {
    super(payload)

    this.price = payload.price
    this.previousPrice = payload.previousPrice
  }

  toJson() {
    return {
      previousPrice: this.previousPrice,
      price: this.price
    }
  }
}
