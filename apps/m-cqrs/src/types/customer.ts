import { AggregateMetadata, BaseEventPayload } from './common.js'

export type CustomerProperties = {
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
  deletedAt?: Date
}

export type AggregateCustomerData = AggregateMetadata & CustomerProperties

// Projection Types

export type CustomerMain = {
  id: string
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
}

export type CustomerMainDBRecord = {
  id?: string
  user_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string
  deleted_at?: Date
  version: number
}

export type CustomerMainDBUpdatePayload = {
  id?: string
  userID?: string
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  deletedAt?: Date
  version: number
}

// Snapshot Types

export type CustomerSnapshotDBRecord = {
  id?: string
  user_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string
  deleted_at?: Date
  version: number
}

export type CustomerSnapshotDBUpdatePayload = {
  id?: string
  userID?: string
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  deletedAt?: Date
  version: number
}

// Requests

export type CreateCustomerRequest = {
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
}

export type RenameCustomerRequest = {
  id: string
  firstName: string
  lastName: string
}

export type ChangeCustomerContactsRequest = {
  id: string
  email: string
  phoneNumber: string
}

// Commands

export type CreateCustomerCommandPayload = {
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
}

export type RenameCustomerCommandPayload = {
  id: string
  firstName: string
  lastName: string
}

export type ChangeCustomerContactsCommandPayload = {
  id: string
  email: string
  phoneNumber: string
}

export type DeleteCustomerCommandPayload = {
  id: string
}

// Events

export type CustomerCreatedV1EventPayload = BaseEventPayload & {
  id: string
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
}

export type CustomerRenamedV1EventPayload = BaseEventPayload & {
  firstName: string
  lastName: string
  previousFirstName: string
  previousLastName: string
}

export type CustomerContactsChangedV1EventPayload = BaseEventPayload & {
  email: string
  phoneNumber: string
  previousEmail?: string
  previousPhoneNumber?: string
}

export type CustomerDeletedV1EventPayload = BaseEventPayload & {
  deletedAt: Date
}
