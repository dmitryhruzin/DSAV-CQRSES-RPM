import { ResumeWorkCommandPayload } from '../../types/work.js'

export class ResumeWorkCommand {
  public readonly id: string

  constructor(public readonly payload: ResumeWorkCommandPayload) {
    this.id = payload.id
  }
}
