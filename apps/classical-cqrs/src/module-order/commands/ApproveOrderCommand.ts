import { ApproveOrderCommandPayload } from '../../types/order.js'

export class ApproveOrderCommand {
  public readonly id: string

  constructor(public readonly payload: ApproveOrderCommandPayload) {
    this.id = payload.id
  }
}
