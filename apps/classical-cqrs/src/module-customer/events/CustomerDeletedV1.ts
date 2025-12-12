import { CustomerDeletedV1EventPayload } from '../../types/customer.js'
import { CustomerDeleted } from './CustomerDeleted.js'

export class CustomerDeletedV1 extends CustomerDeleted {
  public deletedAt: Date

  public version: number = 1

  constructor(payload: CustomerDeletedV1EventPayload) {
    super(payload)

    this.deletedAt = payload.deletedAt
  }

  toJson() {
    return {
      deletedAt: this.deletedAt
    }
  }
}
