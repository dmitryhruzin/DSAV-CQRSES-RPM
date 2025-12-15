import { CarDeletedV1EventPayload } from '../../types/car.js'
import { CarDeleted } from './CarDeleted.js'

export class CarDeletedV1 extends CarDeleted {
  public deletedAt: Date

  public version: number = 1

  constructor(payload: CarDeletedV1EventPayload) {
    super(payload)

    this.deletedAt = payload.deletedAt
  }

  toJson() {
    return {
      deletedAt: this.deletedAt
    }
  }
}
