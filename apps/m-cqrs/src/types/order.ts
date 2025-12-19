import { AggregateMetadata, BaseEventPayload } from './common.js'

export type OrderProperties = {
  title: string
  status: string
  price: string
  discount?: string
  priority?: number
  approved: boolean
}

export type AggregateOrderData = AggregateMetadata & OrderProperties

// Projection Types

export type OrderMain = {
  id: string
  title: string
  price: string
  status: string
  discount?: string
  priority?: number
  approved: boolean
}

export type OrderMainDBRecord = {
  id?: string
  title?: string
  price?: string
  status?: string
  discount?: string
  priority?: number
  approved?: boolean
  version: number
}

export type OrderMainDBUpdatePayload = {
  id?: string
  title?: string
  price?: string
  status?: string
  discount?: string
  priority?: number
  approved?: boolean
  version: number
}

// Snapshot Types

export type OrderSnapshotDBRecord = {
  id?: string
  title?: string
  price?: string
  status?: string
  discount?: string
  priority?: number
  approved?: boolean
  version: number
}

export type OrderSnapshotDBUpdatePayload = {
  id?: string
  title?: string
  price?: string
  status?: string
  discount?: string
  priority?: number
  approved?: boolean
  version: number
}

// Requests

export type CreateOrderRequest = {
  title: string
  price: string
  discount?: string
  priority?: number
}

export type ApproveOrderRequest = {
  id: string
}

export type StartOrderRequest = {
  id: string
}

export type CompleteOrderRequest = {
  id: string
}

export type CancelOrderRequest = {
  id: string
}

// Commands

export type CreateOrderCommandPayload = {
  title: string
  price: string
  discount?: string
  priority?: number
}

export type ApproveOrderCommandPayload = {
  id: string
}

export type StartOrderCommandPayload = {
  id: string
}

export type CompleteOrderCommandPayload = {
  id: string
}

export type CancelOrderCommandPayload = {
  id: string
}

// Events

export type OrderCreatedV1EventPayload = BaseEventPayload & {
  id: string
  title: string
  price: string
  status: string
  approved: boolean
  discount?: string
  priority?: number
}

export type OrderApprovedV1EventPayload = BaseEventPayload

export type OrderStatusChangedV1EventPayload = BaseEventPayload & {
  previousStatus: string
  status: string
}
