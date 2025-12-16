import { ChangeWorkerRoleCommandPayload } from '../../types/worker.js'

export class ChangeWorkerRoleCommand {
  public readonly id: string
  public readonly role: string

  constructor(public readonly payload: ChangeWorkerRoleCommandPayload) {
    this.id = payload.id
    this.role = payload.role
  }
}
