import { CustomerRenamedV1EventPayload } from '../../types/customer.js'
import { CustomerRenamed } from './CustomerRenamed.js'

export class CustomerRenamedV1 extends CustomerRenamed {
  public previousFirstName: string
  public previousLastName: string
  public firstName: string
  public lastName: string

  public version: number = 1

  constructor(payload: CustomerRenamedV1EventPayload) {
    super(payload)

    this.previousFirstName = payload.previousFirstName
    this.previousLastName = payload.previousLastName
    this.firstName = payload.firstName
    this.lastName = payload.lastName
  }

  toJson() {
    return {
      previousFirstName: this.previousFirstName,
      previousLastName: this.previousLastName,
      firstName: this.firstName,
      lastName: this.lastName
    }
  }
}
