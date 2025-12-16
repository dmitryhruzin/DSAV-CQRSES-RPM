import { v4 } from 'uuid'
import { Aggregate } from '../infra/aggregate.js'
import { ChangeWorkerHourlyRateCommand, ChangeWorkerRoleCommand, HireWorkerCommand } from './commands/index.js'
import { WorkerHiredV1, WorkerHourlyRateChangedV1, WorkerRoleChangedV1, WorkerDismissedV1 } from './events/index.js'
import WorkerValidator from './worker.validator.js'
import { AggregateWorkerData } from '../types/worker.js'

export class WorkerAggregate extends Aggregate {
  private hourlyRate: string
  private role: string
  private deletedAt?: Date

  constructor(data: AggregateWorkerData | null = null) {
    if (!data) {
      super()
    } else {
      super(data.id, data.version)

      this.hourlyRate = data.hourlyRate
      this.role = data.role
      this.deletedAt = data.deletedAt
    }
  }

  hire(command: HireWorkerCommand) {
    this.id = v4()

    if (command.hourlyRate && !WorkerValidator.isValidHourlyRate(command.hourlyRate)) {
      throw new Error('Invalid hourly rate')
    }
    if (command.role && !WorkerValidator.isValidRole(command.role)) {
      throw new Error('Invalid role')
    }

    this.hourlyRate = command.hourlyRate
    this.role = command.role
    this.version += 1

    const event = new WorkerHiredV1({
      id: this.id,
      hourlyRate: command.hourlyRate,
      role: command.role,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  changeRole(command: ChangeWorkerRoleCommand) {
    const { role } = command

    if (command.role && !WorkerValidator.isValidRole(command.role)) {
      throw new Error('Invalid role')
    }

    this.version += 1

    const event = new WorkerRoleChangedV1({
      previousRole: this.role,
      role: role,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.role = role

    this.apply(event)

    return [event]
  }

  changeHourlyRate(command: ChangeWorkerHourlyRateCommand) {
    const { hourlyRate } = command

    if (command.hourlyRate && !WorkerValidator.isValidHourlyRate(hourlyRate)) {
      throw new Error('Invalid hourly rate')
    }

    this.version += 1

    const event = new WorkerHourlyRateChangedV1({
      previousHourlyRate: this.hourlyRate,
      hourlyRate: hourlyRate,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.hourlyRate = hourlyRate

    this.apply(event)

    return [event]
  }

  dismiss() {
    if (this.deletedAt) {
      throw new Error('Worker is already dismissed')
    }

    this.version += 1
    this.deletedAt = new Date()

    const event = new WorkerDismissedV1({
      deletedAt: this.deletedAt,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  toJson(): AggregateWorkerData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      hourlyRate: this.hourlyRate,
      role: this.role,
      deletedAt: this.deletedAt
    }
  }
}
