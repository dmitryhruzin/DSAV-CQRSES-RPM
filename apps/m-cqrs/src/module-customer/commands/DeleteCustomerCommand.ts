import { DeleteCustomerCommandPayload } from '../../types/customer.js'

export class DeleteCustomerCommand {
  public readonly id: string

  constructor(public readonly payload: DeleteCustomerCommandPayload) {
    this.id = payload.id
  }
}
