import { RemoveWorkFromOrderCommandPayload } from '../../types/work.js'

export class RemoveWorkFromOrderCommand {
  public readonly id: string

  constructor(public readonly payload: RemoveWorkFromOrderCommandPayload) {
    this.id = payload.id
  }
}
