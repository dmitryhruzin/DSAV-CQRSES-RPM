import { CancelWorkCommandPayload } from '../../types/work.js'

export class CancelWorkCommand {
  public readonly id: string

  constructor(public readonly payload: CancelWorkCommandPayload) {
    this.id = payload.id
  }
}
