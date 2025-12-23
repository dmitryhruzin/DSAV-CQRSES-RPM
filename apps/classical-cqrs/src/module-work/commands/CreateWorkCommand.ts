import { CreateWorkCommandPayload } from '../../types/work.js'

export class CreateWorkCommand {
  public readonly title: string
  public readonly description: string

  constructor(public readonly payload: CreateWorkCommandPayload) {
    this.title = payload.title
    this.description = payload.description
  }
}
