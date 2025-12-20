import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderPrioritySetV1 } from '../events/index.js'

@EventsHandler(OrderPrioritySetV1)
export class OrderPrioritySetEventHandler implements IEventHandler<OrderPrioritySetV1> {
  constructor(private repository: OrderMainProjection) {}

  async handle(event: OrderPrioritySetV1) {
    await this.repository.update(event.aggregateId, {
      priority: event.priority,
      version: event.aggregateVersion
    })
  }
}
