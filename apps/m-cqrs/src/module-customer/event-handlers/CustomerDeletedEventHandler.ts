import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { CustomerDeletedV1 } from '../events/CustomerDeletedV1.js'

@EventsHandler(CustomerDeletedV1)
export class CustomerDeletedEventHandler implements IEventHandler<CustomerDeletedV1> {
  constructor(private repository: CustomerMainProjection) {}

  async handle(event: CustomerDeletedV1) {
    await this.repository.update(event.aggregateId, {
      deletedAt: event.deletedAt,
      version: event.aggregateVersion
    })
  }
}
