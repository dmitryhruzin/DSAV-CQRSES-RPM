import { CompleteOrderCommandPayload } from '../../types/order.js'

export class CompleteOrderCommand {
  public readonly id: string

  constructor(public readonly payload: CompleteOrderCommandPayload) {
    this.id = payload.id
  }
}
