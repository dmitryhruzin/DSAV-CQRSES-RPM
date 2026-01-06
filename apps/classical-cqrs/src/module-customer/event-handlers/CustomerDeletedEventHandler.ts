import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'
import { CustomerDeletedV1 } from '../events/CustomerDeletedV1.js'

@EventsHandler(CustomerDeletedV1)
export class CustomerDeletedEventHandler implements IEventHandler<CustomerDeletedV1> {
  constructor(
    private repository: CustomerMainProjection,
    private repositoryWithCars: CustomerWithCarsProjection
  ) {}

  async handle(event: CustomerDeletedV1) {
    await this.repository.update(event.aggregateId, {
      deletedAt: event.deletedAt,
      version: event.aggregateVersion
    })
    await this.repositoryWithCars.updateCustomer(event.aggregateId, {
      customerDeletedAt: event.deletedAt,
      customerVersion: event.aggregateVersion
    })
  }
}
