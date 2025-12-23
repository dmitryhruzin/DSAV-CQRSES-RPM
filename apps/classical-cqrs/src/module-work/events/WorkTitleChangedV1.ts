import { WorkTitleChangedV1EventPayload } from '../../types/work.js'
import { WorkTitleChanged } from './WorkTitleChanged.js'

export class WorkTitleChangedV1 extends WorkTitleChanged {
  public previousTitle: string
  public title: string

  public version: number = 1

  constructor(payload: WorkTitleChangedV1EventPayload) {
    super(payload)

    this.previousTitle = payload.previousTitle
    this.title = payload.title
  }

  toJson() {
    return {
      previousTitle: this.previousTitle,
      title: this.title
    }
  }
}
