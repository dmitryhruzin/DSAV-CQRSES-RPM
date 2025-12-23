import { PauseWorkCommandPayload } from '../../types/work.js'

export class PauseWorkCommand {
  public readonly id: string

  constructor(public readonly payload: PauseWorkCommandPayload) {
    this.id = payload.id
  }
}
