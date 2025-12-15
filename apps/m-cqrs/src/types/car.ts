import { AggregateMetadata, BaseEventPayload } from './common.js'

export type CarProperties = {
  ownerID: string
  vin: string
  registrationNumber: string
  mileage: number
  deletedAt?: Date
}

export type AggregateCarData = AggregateMetadata & CarProperties

// Projection Types

export type CarMain = {
  id: string
  ownerID: string
  vin: string
  registrationNumber: string
  mileage: number
}

export type CarMainDBRecord = {
  id?: string
  owner_id?: string
  vin?: string
  registration_number?: string
  mileage?: number
  deleted_at?: Date
  version: number
}

export type CarMainDBUpdatePayload = {
  id?: string
  ownerID?: string
  vin?: string
  registrationNumber?: string
  mileage?: number
  deletedAt?: Date
  version: number
}

// Snapshot Types

export type CarSnapshotDBRecord = {
  id?: string
  owner_id?: string
  vin?: string
  registration_number?: string
  mileage?: number
  deleted_at?: Date
  version: number
}

export type CarSnapshotDBUpdatePayload = {
  id?: string
  ownerID?: string
  vin?: string
  registrationNumber?: string
  mileage?: number
  deletedAt?: Date
  version: number
}

// Requests

export type CreateCarRequest = {
  ownerID: string
  vin: string
  registrationNumber: string
  mileage: number
}

export type RecordCarMileageRequest = {
  id: string
  mileage: number
}

export type ChangeCarOwnerRequest = {
  id: string
  ownerID: string
}

export type DeleteCarRequest = {
  id: string
}

// Commands

export type CreateCarCommandPayload = {
  ownerID: string
  vin: string
  registrationNumber: string
  mileage: number
}

export type RecordCarMileageCommandPayload = {
  id: string
  mileage: number
}

export type ChangeCarOwnerCommandPayload = {
  id: string
  ownerID: string
}

export type DeleteCarCommandPayload = {
  id: string
}

// Events

export type CarCreatedV1EventPayload = BaseEventPayload & {
  id: string
  ownerID: string
  vin: string
  registrationNumber: string
  mileage: number
}

export type CarMileageRecordedV1EventPayload = BaseEventPayload & {
  mileage: number
  previousMileage: number
}

export type CarOwnerChangedV1EventPayload = BaseEventPayload & {
  ownerID: string
  previousOwnerID: string
}

export type CarDeletedV1EventPayload = BaseEventPayload & {
  deletedAt: Date
}
