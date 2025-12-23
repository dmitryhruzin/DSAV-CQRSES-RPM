import { AggregateMetadata, BaseEventPayload } from './common.js'

export type WorkProperties = {
  title: string
  description: string
  estimate?: string
  status: string
  assignedTo?: string
  orderID?: string
}

export type AggregateWorkData = AggregateMetadata & WorkProperties

// Projection Types

export type WorkMain = {
  id: string
  title: string
  description: string
  estimate?: string
  status: string
  assignedTo?: string
  orderID?: string
}

export type WorkMainDBRecord = {
  id?: string
  title?: string
  description?: string
  estimate?: string
  status?: string
  assigned_to?: string
  order_id?: string
  version: number
}

export type WorkMainDBUpdatePayload = {
  id?: string
  title?: string
  description?: string
  estimate?: string
  status?: string
  assignedTo?: string
  orderID?: string
  version: number
}

// Requests

export type CreateWorkRequest = {
  title: string
  description: string
}

export type ChangeWorkTitleRequest = {
  id: string
  title: string
}

export type ChangeWorkDescriptionRequest = {
  id: string
  description: string
}

export type SetWorkEstimateRequest = {
  id: string
  estimate: string
}

export type StartWorkRequest = {
  id: string
}

export type PauseWorkRequest = {
  id: string
}

export type ResumeWorkRequest = {
  id: string
}

export type CompleteWorkRequest = {
  id: string
}

export type CancelWorkRequest = {
  id: string
}

export type AssignWorkToWorkerRequest = {
  id: string
  workerID: string
}

export type UnassignWorkFromWorkerRequest = {
  id: string
}

export type AddWorkToOrderRequest = {
  id: string
  orderID: string
}

export type RemoveWorkFromOrderRequest = {
  id: string
}

// Commands

export type CreateWorkCommandPayload = {
  title: string
  description: string
}

export type ChangeWorkTitleCommandPayload = {
  id: string
  title: string
}

export type ChangeWorkDescriptionCommandPayload = {
  id: string
  description: string
}

export type SetWorkEstimateCommandPayload = {
  id: string
  estimate: string
}

export type StartWorkCommandPayload = {
  id: string
}

export type PauseWorkCommandPayload = {
  id: string
}

export type ResumeWorkCommandPayload = {
  id: string
}

export type CompleteWorkCommandPayload = {
  id: string
}

export type CancelWorkCommandPayload = {
  id: string
}

export type AssignWorkToWorkerCommandPayload = {
  id: string
  workerID: string
}

export type UnassignWorkFromWorkerCommandPayload = {
  id: string
}

export type AddWorkToOrderCommandPayload = {
  id: string
  orderID: string
}

export type RemoveWorkFromOrderCommandPayload = {
  id: string
}

// Events

export type WorkCreatedV1EventPayload = BaseEventPayload & {
  id: string
  title: string
  description: string
  status: string
}

export type WorkTitleChangedV1EventPayload = BaseEventPayload & {
  previousTitle: string
  title: string
}

export type WorkDescriptionChangedV1EventPayload = BaseEventPayload & {
  previousDescription: string
  description: string
}

export type WorkEstimateSetV1EventPayload = BaseEventPayload & {
  previousEstimate?: string
  estimate?: string
}

export type WorkStatusChangedV1EventPayload = BaseEventPayload & {
  previousStatus?: string
  status: string
}

export type WorkAssignedToWorkerV1EventPayload = BaseEventPayload & {
  previousWorkerID?: string
  workerID: string
}

export type WorkUnassignedFromWorkerV1EventPayload = BaseEventPayload & {
  previousWorkerID: string
}

export type WorkAddedToOrderV1EventPayload = BaseEventPayload & {
  previousOrderID?: string
  orderID: string
}

export type WorkRemovedFromOrderV1EventPayload = BaseEventPayload & {
  previousOrderID: string
}
