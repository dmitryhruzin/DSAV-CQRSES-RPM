import { CompleteWorkCommandPayload } from '../../types/work.js'

export class CompleteWorkCommand {
  public readonly id: string

  constructor(public readonly payload: CompleteWorkCommandPayload) {
    this.id = payload.id
  }
}
