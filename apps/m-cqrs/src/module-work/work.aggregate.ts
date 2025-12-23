import { v4 } from 'uuid'
import { Aggregate } from '../infra/aggregate.js'
import {
  CreateWorkCommand,
  ChangeWorkTitleCommand,
  ChangeWorkDescriptionCommand,
  SetWorkEstimateCommand,
  AssignWorkToWorkerCommand,
  AddWorkToOrderCommand
} from './commands/index.js'
import {
  WorkCreatedV1,
  WorkTitleChangedV1,
  WorkDescriptionChangedV1,
  WorkEstimateSetV1,
  WorkStatusChangedV1,
  WorkAssignedToWorkerV1,
  WorkUnassignedFromWorkerV1,
  WorkRemovedFromOrderV1,
  WorkAddedToOrderV1
} from './events/index.js'
import WorkValidator from './work.validator.js'
import { AggregateWorkData } from '../types/work.js'
import { STATUS } from '../constants/work.js'
import { BaseEvent } from '../infra/BaseEvent.js'

export class WorkAggregate extends Aggregate {
  private title: string
  private description: string
  private estimate?: string
  private status: string
  private assignedTo?: string
  private orderID?: string

  constructor(data: AggregateWorkData | null = null) {
    if (!data) {
      super()
    } else {
      super(data.id, data.version)

      this.title = data.title
      this.description = data.description
      this.estimate = data.estimate
      this.status = data.status
      this.assignedTo = data.assignedTo
      this.orderID = data.orderID
    }
  }

  create(command: CreateWorkCommand) {
    this.id = v4()

    if (!WorkValidator.isValidTitle(command.title)) {
      throw new Error('Invalid title')
    }
    if (!WorkValidator.isValidDescription(command.description)) {
      throw new Error('Invalid description')
    }

    this.title = command.title
    this.description = command.description
    this.status = STATUS.TODO
    this.version += 1

    const event = new WorkCreatedV1({
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  changeTitle(command: ChangeWorkTitleCommand) {
    const { title } = command

    if (!WorkValidator.isValidTitle(command.title)) {
      throw new Error('Invalid title')
    }

    this.version += 1

    const event = new WorkTitleChangedV1({
      previousTitle: this.title,
      title: title,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.title = title

    this.apply(event)

    return [event]
  }

  changeDescription(command: ChangeWorkDescriptionCommand) {
    const { description } = command

    if (!WorkValidator.isValidDescription(description)) {
      throw new Error('Invalid description')
    }

    this.version += 1

    const event = new WorkDescriptionChangedV1({
      previousDescription: this.description,
      description: description,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.description = description

    this.apply(event)

    return [event]
  }

  setEstimate(command: SetWorkEstimateCommand) {
    const { estimate } = command

    if (!WorkValidator.isValidEstimate(estimate)) {
      throw new Error('Invalid estimate')
    }

    this.version += 1

    const event = new WorkEstimateSetV1({
      previousEstimate: this.estimate,
      estimate: estimate,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.estimate = estimate

    this.apply(event)

    return [event]
  }

  start() {
    if (this.status !== STATUS.TODO) {
      throw new Error('Work can be started only from TODO status')
    }

    this.version += 1

    const event = new WorkStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.IN_PROGRESS,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.IN_PROGRESS

    this.apply(event)

    return [event]
  }

  pause() {
    if (this.status !== STATUS.IN_PROGRESS) {
      throw new Error('Work can be paused only if it is in IN_PROGRESS status')
    }

    this.version += 1

    const event = new WorkStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.PAUSED,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.PAUSED

    this.apply(event)

    return [event]
  }

  resume() {
    if (this.status !== STATUS.PAUSED) {
      throw new Error('Work can be resumed only if it is in PAUSED status')
    }

    this.version += 1

    const event = new WorkStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.IN_PROGRESS,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.IN_PROGRESS

    this.apply(event)

    return [event]
  }

  complete() {
    if (this.status !== STATUS.IN_PROGRESS) {
      throw new Error('Work can be completed only if it is in IN_PROGRESS status')
    }

    this.version += 1

    const event = new WorkStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.COMPLETED,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.COMPLETED

    this.apply(event)

    return [event]
  }

  cancel() {
    if (this.status === STATUS.CANCELLED) {
      throw new Error('Work is already cancelled')
    }

    this.version += 1

    const event = new WorkStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.CANCELLED,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.CANCELLED

    this.apply(event)

    return [event]
  }

  assignToWorker(command: AssignWorkToWorkerCommand) {
    const { workerID } = command

    if (this.status !== STATUS.TODO) {
      throw new Error('Work can be assigned only if it is in TODO status')
    }

    this.version += 1

    const assignEvent = new WorkAssignedToWorkerV1({
      previousWorkerID: this.assignedTo,
      workerID: workerID,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.assignedTo = workerID

    this.apply(assignEvent)

    this.version += 1

    const estimateEvent = new WorkEstimateSetV1({
      previousEstimate: this.estimate,
      estimate: undefined,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.estimate = undefined

    this.apply(estimateEvent)

    return [assignEvent, estimateEvent]
  }

  unassignFromWorker() {
    if (!this.assignedTo) {
      throw new Error('Work is not assigned to any worker')
    }

    this.version += 1

    const unassignEvent = new WorkUnassignedFromWorkerV1({
      previousWorkerID: this.assignedTo,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.assignedTo = undefined

    this.apply(unassignEvent)

    this.version += 1

    const estimateEvent = new WorkEstimateSetV1({
      previousEstimate: this.estimate,
      estimate: undefined,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.estimate = undefined

    this.apply(estimateEvent)

    const events: BaseEvent[] = [unassignEvent, estimateEvent]

    if (this.status !== STATUS.TODO) {
      this.version += 1

      const statusEvent = new WorkStatusChangedV1({
        previousStatus: this.status,
        status: STATUS.CANCELLED,
        aggregateId: this.id,
        aggregateVersion: this.version
      })

      this.status = STATUS.CANCELLED

      this.apply(statusEvent)
      events.push(statusEvent)
    }

    return events
  }

  addToOrder(command: AddWorkToOrderCommand) {
    const { orderID } = command

    this.version += 1

    const event = new WorkAddedToOrderV1({
      previousOrderID: this.orderID,
      orderID: orderID,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.orderID = orderID

    this.apply(event)

    return [event]
  }

  removeFromOrder() {
    if (!this.orderID) {
      throw new Error('Work is not added to any order')
    }

    this.version += 1

    const event = new WorkRemovedFromOrderV1({
      previousOrderID: this.orderID,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.orderID = undefined

    this.apply(event)

    return [event]
  }

  toJson(): AggregateWorkData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      title: this.title,
      description: this.description,
      estimate: this.estimate,
      status: this.status,
      assignedTo: this.assignedTo,
      orderID: this.orderID
    }
  }
}
