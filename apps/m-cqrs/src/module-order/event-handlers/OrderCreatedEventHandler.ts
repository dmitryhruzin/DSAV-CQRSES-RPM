import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { OrderCreatedV1 } from '../events/index.js'
import { OrderMainProjection } from '../projections/order-main.projection.js'

@EventsHandler(OrderCreatedV1)
export class OrderCreatedEventHandler implements IEventHandler<OrderCreatedV1> {
  constructor(private repository: OrderMainProjection) {}

  async handle(event: OrderCreatedV1) {
    await this.repository.save({ ...event.toJson(), version: 1 })
  }
}
