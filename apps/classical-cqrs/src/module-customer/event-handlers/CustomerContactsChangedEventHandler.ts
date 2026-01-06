import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { CustomerWithCarsProjection } from '../projections/customer-with-cars.projection.js'
import { CustomerContactsChangedV1 } from '../events/index.js'

@EventsHandler(CustomerContactsChangedV1)
export class CustomerContactsChangedEventHandler implements IEventHandler<CustomerContactsChangedV1> {
  constructor(
    private repository: CustomerMainProjection,
    private repositoryWithCars: CustomerWithCarsProjection
  ) {}

  async handle(event: CustomerContactsChangedV1) {
    await this.repository.update(event.aggregateId, {
      email: event.email,
      phoneNumber: event.phoneNumber,
      version: event.aggregateVersion
    })
    await this.repositoryWithCars.updateCustomer(event.aggregateId, {
      email: event.email,
      phoneNumber: event.phoneNumber,
      customerVersion: event.aggregateVersion
    })
  }
}
