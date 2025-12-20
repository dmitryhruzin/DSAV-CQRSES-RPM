import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { OrderPriceChangedV1 } from '../events/index.js'

@EventsHandler(OrderPriceChangedV1)
export class OrderPriceChangedEventHandler implements IEventHandler<OrderPriceChangedV1> {
  constructor(private repository: OrderMainProjection) {}

  async handle(event: OrderPriceChangedV1) {
    await this.repository.update(event.aggregateId, {
      price: event.price,
      version: event.aggregateVersion
    })
  }
}
