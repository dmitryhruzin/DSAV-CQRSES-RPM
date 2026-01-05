import { CarOwnerChangedV1EventPayload } from '../../types/car.js'
import { AggregateCustomerData } from '../../types/customer.js'
import { CarOwnerChanged } from './CarOwnerChanged.js'

export class CarOwnerChangedV1 extends CarOwnerChanged {
  public previousOwnerID: string
  public ownerID: string
  public owner: AggregateCustomerData

  public version: number = 1

  constructor(payload: CarOwnerChangedV1EventPayload) {
    super(payload)

    this.previousOwnerID = payload.previousOwnerID
    this.ownerID = payload.ownerID
    this.owner = payload.owner
  }

  toJson() {
    return {
      previousOwnerID: this.previousOwnerID,
      ownerID: this.ownerID,
      owner: this.owner
    }
  }
}
