export type AcknowledgementResponse = {
  status: string
}

export type Event = {
  constructor: {
    name: string
  }
  version: number
  aggregateId: string
  aggregateVersion: number
  toJson(): { [key: string]: unknown } | string
}

export type BaseEventPayload = {
  aggregateId: string
  aggregateVersion: number
}

export type StoredEvent = {
  name: string
  version: number
  aggregateId: string
  aggregateVersion: number
  body: { [key: string]: unknown }
}

export type AggregateMetadata = {
  id: string
  version: number
}

export class VersionMismatchError extends Error {}

export type Paginated<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}
