import { ChangeCustomerContactsCommandPayload } from '../../types/customer.js'

export class ChangeCustomerContactsCommand {
  public readonly id: string
  public readonly email: string
  public readonly phoneNumber: string

  constructor(public readonly payload: ChangeCustomerContactsCommandPayload) {
    this.id = payload.id
    this.email = payload.email
    this.phoneNumber = payload.phoneNumber
  }
}
