import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderDiscountAppliedV1 } from '../events/index.js'

@EventsHandler(OrderDiscountAppliedV1)
export class OrderDiscountAppliedEventHandler implements IEventHandler<OrderDiscountAppliedV1> {
  constructor(private repository: OrderMainProjection) {}

  async handle(event: OrderDiscountAppliedV1) {
    await this.repository.update(event.aggregateId, {
      discount: event.discount,
      version: event.aggregateVersion
    })
  }
}
