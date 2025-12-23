import { WorkDescriptionChangedV1EventPayload } from '../../types/work.js'
import { WorkDescriptionChanged } from './WorkDescriptionChanged.js'

export class WorkDescriptionChangedV1 extends WorkDescriptionChanged {
  public description: string
  public previousDescription: string
  public version: number = 1

  constructor(payload: WorkDescriptionChangedV1EventPayload) {
    super(payload)

    this.description = payload.description
    this.previousDescription = payload.previousDescription
  }

  toJson() {
    return {
      previousDescription: this.previousDescription,
      description: this.description
    }
  }
}
