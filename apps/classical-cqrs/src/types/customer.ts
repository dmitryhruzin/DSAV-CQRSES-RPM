import { AggregateMetadata, BaseEventPayload } from './common.js'

export type CustomerProperties = {
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
}

export type AggregateCustomerData = AggregateMetadata & CustomerProperties

export type AggregateCustomerCreateData = Omit<AggregateCustomerData, 'version'>
export type AggregateCustomerUpdateData = Omit<AggregateCustomerData, 'id'>

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
  id: string
  userid: string
  firstname: string
  lastname: string
  email?: string
  phonenumber?: string
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

// Commands

export type CreateCustomerCommandPayload = {
  userID: string
  firstName: string
  lastName: string
  email?: string
  phoneNumber?: string
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
