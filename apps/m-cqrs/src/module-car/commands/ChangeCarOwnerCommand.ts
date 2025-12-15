import { ChangeCarOwnerCommandPayload } from '../../types/car.js'

export class ChangeCarOwnerCommand {
  public readonly id: string
  public readonly ownerID: string

  constructor(public readonly payload: ChangeCarOwnerCommandPayload) {
    this.id = payload.id
    this.ownerID = payload.ownerID
  }
}
