import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderStatusChangedV1 } from '../events/index.js'

@EventsHandler(OrderStatusChangedV1)
export class OrderStatusChangedEventHandler implements IEventHandler<OrderStatusChangedV1> {
  constructor(private repository: OrderMainProjection) {}

  async handle(event: OrderStatusChangedV1) {
    await this.repository.update(event.aggregateId, {
      status: event.status,
      version: event.aggregateVersion
    })
  }
}
