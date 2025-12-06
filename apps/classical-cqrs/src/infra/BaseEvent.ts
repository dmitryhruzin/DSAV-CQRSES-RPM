import { Event, BaseEventPayload } from '../types/common.js'

export class BaseEvent implements Event {
  public aggregateId: string

  public aggregateVersion: number

  public version = 0

  constructor(payload: BaseEventPayload) {
    this.aggregateId = payload.aggregateId
    this.aggregateVersion = payload.aggregateVersion
  }

  toJson(): { [key: string]: unknown } {
    // Custom implementation for each event
    return {}
  }
}
