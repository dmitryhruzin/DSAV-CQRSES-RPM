import { SetOrderPriorityCommandPayload } from '../../types/order.js'

export class SetOrderPriorityCommand {
  public readonly id: string
  public readonly priority: number

  constructor(public readonly payload: SetOrderPriorityCommandPayload) {
    this.id = payload.id
    this.priority = payload.priority
  }
}
