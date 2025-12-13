import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerCreatedV1 } from '../events/index.js'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'

@EventsHandler(CustomerCreatedV1)
export class CustomerCreatedEventHandler implements IEventHandler<CustomerCreatedV1> {
  constructor(private repository: CustomerMainProjection) {}

  async handle(event: CustomerCreatedV1) {
    await this.repository.save({ ...event.toJson(), version: 1 })
  }
}
