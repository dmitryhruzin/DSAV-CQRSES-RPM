import { v4 } from 'uuid'
import { Aggregate } from '../infra/aggregate.js'
import {
  ChangeOrderPriceCommand,
  CreateOrderCommand,
  ApplyDiscountToOrderCommand,
  SetOrderPriorityCommand
} from './commands/index.js'
import {
  OrderApprovedV1,
  OrderCreatedV1,
  OrderPriceChangedV1,
  OrderStatusChangedV1,
  OrderDiscountAppliedV1,
  OrderPrioritySetV1
} from './events/index.js'
import OrderValidator from './order.validator.js'
import { AggregateOrderData } from '../types/order.js'
import { STATUS } from '../constants/order.js'
import { Snapshot } from '../types/common.js'

export class OrderAggregate extends Aggregate {
  private title: string
  private price: string
  private discount?: string
  private priority?: number
  private status: string
  private approved: boolean

  constructor(snapshot: Snapshot<OrderAggregate> = null) {
    if (!snapshot) {
      super()
    } else {
      super(snapshot.aggregateId, snapshot.aggregateVersion)

      if (snapshot.state) {
        this.title = snapshot.state.title
        this.price = snapshot.state.price
        this.discount = snapshot.state.discount
        this.priority = snapshot.state.priority
        this.status = snapshot.state.status
        this.approved = snapshot.state.approved
      }
    }
  }

  create(command: CreateOrderCommand) {
    this.id = v4()

    if (!OrderValidator.isValidTitle(command.title)) {
      throw new Error('Invalid title')
    }
    if (!OrderValidator.isValidPrice(command.price)) {
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

  replayOrderCreatedV1(event: OrderCreatedV1) {
    this.id = event.id
    this.title = event.title
    this.price = event.price
    this.discount = event.discount
    this.priority = event.priority
    this.status = event.status
    this.approved = event.approved

    this.version += 1
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

  replayOrderApprovedV1() {
    this.approved = true

    this.version += 1
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

  cancel() {
    if (this.status === STATUS.COMPLETED) {
      throw new Error('Completed order can not be cancelled')
    }

    this.version += 1

    const event = new OrderStatusChangedV1({
      previousStatus: this.status,
      status: STATUS.CANCELLED,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.status = STATUS.CANCELLED

    this.apply(event)

    return [event]
  }

  replayOrderStatusChangedV1(event: OrderStatusChangedV1) {
    this.status = event.status

    this.version += 1
  }

  changePrice(command: ChangeOrderPriceCommand) {
    const { price } = command

    if (!OrderValidator.isValidPrice(price)) {
      throw new Error('Invalid price')
    }

    this.version += 1

    const event = new OrderPriceChangedV1({
      previousPrice: this.price,
      price,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.price = price

    this.apply(event)

    return [event]
  }

  replayOrderPriceChangedV1(event: OrderPriceChangedV1) {
    this.price = event.price

    this.version += 1
  }

  applyDiscount(command: ApplyDiscountToOrderCommand) {
    const { discount } = command

    if (!OrderValidator.isValidPrice(discount)) {
      throw new Error('Invalid discount')
    }

    this.version += 1

    const event = new OrderDiscountAppliedV1({
      previousDiscount: this.discount,
      discount,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.discount = discount

    this.apply(event)

    return [event]
  }

  replayOrderDiscountAppliedV1(event: OrderDiscountAppliedV1) {
    this.discount = event.discount

    this.version += 1
  }

  setPriority(command: SetOrderPriorityCommand) {
    const { priority } = command

    if (!OrderValidator.isValidPriority(priority)) {
      throw new Error('Invalid priority')
    }

    this.version += 1

    const event = new OrderPrioritySetV1({
      previousPriority: this.priority,
      priority,
      aggregateId: this.id,
      aggregateVersion: this.version
    })

    this.priority = priority

    this.apply(event)

    return [event]
  }

  replayOrderPrioritySetV1(event: OrderPrioritySetV1) {
    this.priority = event.priority

    this.version += 1
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
