import { ChangeWorkDescriptionCommandPayload } from '../../types/work.js'

export class ChangeWorkDescriptionCommand {
  public readonly id: string
  public readonly description: string

  constructor(public readonly payload: ChangeWorkDescriptionCommandPayload) {
    this.id = payload.id
    this.description = payload.description
  }
}
