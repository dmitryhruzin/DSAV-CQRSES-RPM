import { CreateOrderCommandPayload } from '../../types/order.js'

export class CreateOrderCommand {
  public readonly title: string
  public readonly price: string
  public readonly discount?: string
  public readonly priority?: number

  constructor(public readonly payload: CreateOrderCommandPayload) {
    this.title = payload.title
    this.price = payload.price
    this.discount = payload.discount
    this.priority = payload.priority
  }
}
