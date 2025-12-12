import { CustomerContactsChangedV1EventPayload } from '../../types/customer.js'
import { CustomerContactsChanged } from './CustomerContactsChanged.js'

export class CustomerContactsChangedV1 extends CustomerContactsChanged {
  public previousEmail?: string
  public previousPhoneNumber?: string
  public email: string
  public phoneNumber: string
  public version: number = 1

  constructor(payload: CustomerContactsChangedV1EventPayload) {
    super(payload)

    this.previousEmail = payload.previousEmail
    this.previousPhoneNumber = payload.previousPhoneNumber
    this.email = payload.email
    this.phoneNumber = payload.phoneNumber
  }

  toJson() {
    return {
      previousEmail: this.previousEmail,
      previousPhoneNumber: this.previousPhoneNumber,
      email: this.email,
      phoneNumber: this.phoneNumber
    }
  }
}
