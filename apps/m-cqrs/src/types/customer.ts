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

export type CustomerWithCars = {
  id: string
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
  cars: {
    id: string
    vin: string
    registrationNumber: string
    mileage: number
  }[]
}

export type CustomerWithCarsDBRecord = {
  id?: string
  customer_id?: string
  user_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string
  customer_deleted_at?: Date
  customer_version?: number
  car_id?: string
  vin?: string
  registration_number?: string
  mileage?: number
  car_deleted_at?: Date
  car_version?: number
}

export type CustomerWithGroupedCarsDBRecord = {
  customer_id: string
  user_id: string
  first_name: string
  last_name: string
  email?: string
  phone_number?: string
  cars: {
    id: string
    vin: string
    registration_number: string
    mileage: number
  }[]
}

export type CustomerWithCarsDBUpdatePayload = {
  id?: string
  customerID?: string
  userID?: string
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  customerDeletedAt?: Date
  customerVersion?: number
  carID?: string
  vin?: string
  registrationNumber?: string
  mileage?: number
  carDeletedAt?: Date
  carVersion?: number
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
