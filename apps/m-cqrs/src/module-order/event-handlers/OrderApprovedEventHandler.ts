import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderApprovedV1 } from '../events/index.js'

@EventsHandler(OrderApprovedV1)
export class OrderApprovedEventHandler implements IEventHandler<OrderApprovedV1> {
  constructor(private repository: OrderMainProjection) {}

  async handle(event: OrderApprovedV1) {
    await this.repository.update(event.aggregateId, {
      approved: true,
      version: event.aggregateVersion
    })
  }
}
