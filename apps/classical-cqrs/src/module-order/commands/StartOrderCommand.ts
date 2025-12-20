import { StartOrderCommandPayload } from '../../types/order.js'

export class StartOrderCommand {
  public readonly id: string

  constructor(public readonly payload: StartOrderCommandPayload) {
    this.id = payload.id
  }
}
