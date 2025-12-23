import { ChangeWorkTitleCommandPayload } from '../../types/work.js'

export class ChangeWorkTitleCommand {
  public readonly id: string
  public readonly title: string

  constructor(public readonly payload: ChangeWorkTitleCommandPayload) {
    this.id = payload.id
    this.title = payload.title
  }
}
