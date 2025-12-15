import { DeleteCarCommandPayload } from '../../types/car.js'

export class DeleteCarCommand {
  public readonly id: string

  constructor(public readonly payload: DeleteCarCommandPayload) {
    this.id = payload.id
  }
}
