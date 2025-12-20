import { CancelOrderCommandPayload } from '../../types/order.js'

export class CancelOrderCommand {
  public readonly id: string

  constructor(public readonly payload: CancelOrderCommandPayload) {
    this.id = payload.id
  }
}
