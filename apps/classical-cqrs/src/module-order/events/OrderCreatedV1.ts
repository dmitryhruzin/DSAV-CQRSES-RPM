import { OrderCreatedV1EventPayload } from '../../types/order.js'
import { OrderCreated } from './OrderCreated.js'

export class OrderCreatedV1 extends OrderCreated {
  public id: string
  public title: string
  public price: string
  public status: string
  public approved: boolean
  public discount?: string
  public priority?: number

  public version: number = 1

  constructor(payload: OrderCreatedV1EventPayload) {
    super(payload)

    this.id = payload.id
    this.title = payload.title
    this.price = payload.price
    this.discount = payload.discount
    this.priority = payload.priority
    this.status = payload.status
    this.approved = payload.approved
  }

  toJson() {
    return {
      id: this.id,
      title: this.title,
      price: this.price,
      discount: this.discount,
      priority: this.priority,
      status: this.status,
      approved: this.approved
    }
  }
}
