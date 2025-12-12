import { RenameCustomerCommandPayload } from '../../types/customer.js'

export class RenameCustomerCommand {
  public readonly id: string
  public readonly firstName: string
  public readonly lastName: string

  constructor(public readonly payload: RenameCustomerCommandPayload) {
    this.id = payload.id
    this.firstName = payload.firstName
    this.lastName = payload.lastName
  }
}
