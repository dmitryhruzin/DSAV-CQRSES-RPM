import { CustomerCreatedV1EventPayload } from '../../types/customer.js'
import { CustomerCreated } from './CustomerCreated.js'

export class CustomerCreatedV1 extends CustomerCreated {
  public id: string

  public userID: string
  public firstName: string
  public lastName: string
  public email?: string
  public phoneNumber?: string

  public version: number = 1

  constructor(payload: CustomerCreatedV1EventPayload) {
    super(payload)

    this.id = payload.id
    this.userID = payload.userID
    this.firstName = payload.firstName
    this.lastName = payload.lastName
    this.email = payload.email
    this.phoneNumber = payload.phoneNumber
  }

  toJson() {
    return {
      id: this.id,
      userID: this.userID,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber
    }
  }
}
