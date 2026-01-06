import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { CustomerRenamedV1 } from '../events/index.js'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'

@EventsHandler(CustomerRenamedV1)
export class CustomerRenamedEventHandler implements IEventHandler<CustomerRenamedV1> {
  constructor(
    private repository: CustomerMainProjection,
    private repositoryWithCars: CustomerWithCarsProjection
  ) {}

  async handle(event: CustomerRenamedV1) {
    await this.repository.update(event.aggregateId, {
      firstName: event.firstName,
      lastName: event.lastName,
      version: event.aggregateVersion
    })
    await this.repositoryWithCars.updateCustomer(event.aggregateId, {
      firstName: event.firstName,
      lastName: event.lastName,
      customerVersion: event.aggregateVersion
    })
  }
}
