import { AggregateMetadata, BaseEventPayload } from './common.js'

export type WorkerProperties = {
  hourlyRate: string
  role: string
  deletedAt?: Date
}

export type AggregateWorkerData = AggregateMetadata & WorkerProperties

// Projection Types

export type WorkerMain = {
  id: string
  hourlyRate: string
  role: string
}

export type WorkerMainDBRecord = {
  id?: string
  hourly_rate?: string
  role?: string
  deleted_at?: Date
  version: number
}

export type WorkerMainDBUpdatePayload = {
  id?: string
  hourlyRate?: string
  role?: string
  deletedAt?: Date
  version: number
}

// Snapshot Types

export type WorkerSnapshotDBRecord = {
  id?: string
  hourly_rate?: string
  role?: string
  mileage?: number
  deleted_at?: Date
  version: number
}

export type WorkerSnapshotDBUpdatePayload = {
  id?: string
  hourlyRate?: string
  role?: string
  deletedAt?: Date
  version: number
}

// Requests

export type HireWorkerRequest = {
  hourlyRate: string
  role: string
}

export type ChangeWorkerRolerRequest = {
  id: string
  role: string
}

export type ChangeWorkerHourlyRateRequest = {
  id: string
  hourlyRate: string
}

// Commands

export type HireWorkerCommandPayload = {
  hourlyRate: string
  role: string
}

export type ChangeWorkerRoleCommandPayload = {
  id: string
  role: string
}

export type ChangeWorkerHourlyRateCommandPayload = {
  id: string
  hourlyRate: string
}

export type DismissWorkerCommandPayload = {
  id: string
}

// Events

export type WorkerHiredV1EventPayload = BaseEventPayload & {
  id: string
  hourlyRate: string
  role: string
}

export type WorkerRoleChangedV1EventPayload = BaseEventPayload & {
  role: string
  previousRole: string
}

export type WorkerHourlyRateChangedV1EventPayload = BaseEventPayload & {
  hourlyRate: string
  previousHourlyRate: string
}

export type WorkerDismissedV1EventPayload = BaseEventPayload & {
  deletedAt: Date
}
