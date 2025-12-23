import { AddWorkToOrderCommandPayload } from '../../types/work.js'

export class AddWorkToOrderCommand {
  public readonly id: string
  public readonly orderID: string

  constructor(public readonly payload: AddWorkToOrderCommandPayload) {
    this.id = payload.id
    this.orderID = payload.orderID
  }
}
