import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { GetCustomerWithCarsByIdQuery } from '../queries/index.js'
import { CustomerWithCars } from '../../types/customer.js'
import { CustomerWithCarsProjection } from '../projections/index.js'

@QueryHandler(GetCustomerWithCarsByIdQuery)
export class GetCustomerWithCarsByIdQueryHandler implements IQueryHandler<GetCustomerWithCarsByIdQuery> {
  constructor(private repository: CustomerWithCarsProjection) {}

  async execute(query: GetCustomerWithCarsByIdQuery): Promise<CustomerWithCars> {
    return this.repository.getByCustomerId(query.id)
  }
}
