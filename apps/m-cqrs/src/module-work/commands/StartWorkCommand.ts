import { StartWorkCommandPayload } from '../../types/work.js'

export class StartWorkCommand {
  public readonly id: string

  constructor(public readonly payload: StartWorkCommandPayload) {
    this.id = payload.id
  }
}
