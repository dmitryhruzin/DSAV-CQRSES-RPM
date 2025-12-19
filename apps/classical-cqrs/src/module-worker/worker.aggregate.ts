import { v4 } from 'uuid'
import { Aggregate } from '../infra/aggregate.js'
import { ChangeWorkerHourlyRateCommand, ChangeWorkerRoleCommand, HireWorkerCommand } from './commands/index.js'
import { WorkerHiredV1, WorkerHourlyRateChangedV1, WorkerRoleChangedV1, WorkerDismissedV1 } from './events/index.js'
import WorkerValidator from './worker.validator.js'
import { AggregateWorkerData } from '../types/worker.js'
import { Snapshot } from '../types/common.js'

export class WorkerAggregate extends Aggregate {
  private hourlyRate: string
  private role: string
  private deletedAt?: Date

  constructor(snapshot: Snapshot<WorkerAggregate> = null) {
    if (!snapshot) {
      super()
    } else {
      super(snapshot.aggregateId, snapshot.aggregateVersion)

      if (snapshot.state) {
        this.role = snapshot.state.role
        this.hourlyRate = snapshot.state.hourlyRate
        this.deletedAt = snapshot.state.deletedAt
      }
    }
  }

  hire(command: HireWorkerCommand) {
    this.id = v4()

    if (!WorkerValidator.isValidHourlyRate(command.hourlyRate)) {
      throw new Error('Invalid hourly rate')
    }
    if (!WorkerValidator.isValidRole(command.role)) {
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

  replayWorkerHiredV1(event: WorkerHiredV1) {
    this.id = event.id
    this.hourlyRate = event.hourlyRate
    this.role = event.role

    this.version += 1
  }

  changeRole(command: ChangeWorkerRoleCommand) {
    const { role } = command

    if (!WorkerValidator.isValidRole(command.role)) {
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

  replayWorkerHourlyRateChangedV1(event: WorkerHourlyRateChangedV1) {
    this.hourlyRate = event.hourlyRate

    this.version += 1
  }

  changeHourlyRate(command: ChangeWorkerHourlyRateCommand) {
    const { hourlyRate } = command

    if (!WorkerValidator.isValidHourlyRate(hourlyRate)) {
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

  replayWorkerRoleChangedV1(event: WorkerRoleChangedV1) {
    this.role = event.role

    this.version += 1
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

  replayWorkerDismissedV1(event: WorkerDismissedV1) {
    this.deletedAt = event.deletedAt

    this.version += 1
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
