import { WorkCreatedV1EventPayload } from '../../types/work.js'
import { WorkCreated } from './WorkCreated.js'

export class WorkCreatedV1 extends WorkCreated {
  public id: string
  public title: string
  public description: string
  public status: string

  public version: number = 1

  constructor(payload: WorkCreatedV1EventPayload) {
    super(payload)

    this.id = payload.id
    this.title = payload.title
    this.description = payload.description
    this.status = payload.status
  }

  toJson() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status
    }
  }
}
