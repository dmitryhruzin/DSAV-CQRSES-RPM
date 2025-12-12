import { CreateCustomerCommandPayload } from '../../types/customer.js'

export class CreateCustomerCommand {
  public readonly firstName: string
  public readonly lastName: string
  public readonly email?: string
  public readonly phoneNumber?: string
  public readonly userID: string

  constructor(public readonly payload: CreateCustomerCommandPayload) {
    this.userID = payload.userID
    this.firstName = payload.firstName
    this.lastName = payload.lastName
    this.email = payload.email
    this.phoneNumber = payload.phoneNumber
  }
}
