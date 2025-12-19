import { v4 } from 'uuid'
import { Aggregate } from '../infra/aggregate.js'
import { CreateOrderCommand } from './commands/index.js'
import { OrderApprovedV1, OrderCreatedV1, OrderStatusChangedV1 } from './events/index.js'
import OrderValidator from './order.validator.js'
import { AggregateOrderData } from '../types/order.js'
import { STATUS } from '../constants/order.js'

export class OrderAggregate extends Aggregate {
  private title: string
  private price: string
  private discount?: string
  private priority?: number
  private status: string
  private approved: boolean

  constructor(data: AggregateOrderData | null = null) {
    if (!data) {
      super()
    } else {
      super(data.id, data.version)

      this.title = data.title
      this.price = data.price
      this.discount = data.discount
      this.priority = data.priority
      this.status = data.status
      this.approved = data.approved
    }
  }

  create(command: CreateOrderCommand) {
    this.id = v4()

    if (command.title && !OrderValidator.isValidTitle(command.title)) {
      throw new Error('Invalid title')
    }
    if (command.price && !OrderValidator.isValidPrice(command.price)) {
      throw new Error('Invalid price')
    }
    if (command.discount && !OrderValidator.isValidPrice(command.discount)) {
      throw new Error('Invalid discount')
    }
    if (command.priority && !OrderValidator.isValidPriority(command.priority)) {
      throw new Error('Invalid priority')
    }

    this.title = command.title
    this.price = command.price
    this.discount = command.discount
    this.priority = command.priority
    this.status = STATUS.TODO
    this.approved = false
    this.version += 1

    const event = new OrderCreatedV1({
      id: this.id,
      title: command.title,
      price: command.price,
      discount: command.discount,
      priority: command.priority,
      status: this.status,
      approved: this.approved,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  approve() {
    this.approved = true
    this.version += 1

    const event = new OrderApprovedV1({
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.apply(event)

    return [event]
  }

  start() {
    if (this.status !== STATUS.TODO) {
      throw new Error('Order with status other than TODO cannot be started')
    }
    if (!this.approved) {
      throw new Error('Only approved orders can be started')
    }

    this.version += 1

    const event = new OrderStatusChangedV1({
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
      throw new Error('Order with status other than IN_PROGRESS cannot be completed')
    }

    this.version += 1

    const event = new OrderStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.COMPLETED,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.COMPLETED

    this.apply(event)

    return [event]
  }

  toJson(): AggregateOrderData {
    if (!this.id) {
      throw new Error('Aggregate is empty')
    }

    return {
      id: this.id,
      version: this.version,
      title: this.title,
      status: this.status,
      price: this.price,
      discount: this.discount,
      priority: this.priority,
      approved: this.approved
    }
  }
}
