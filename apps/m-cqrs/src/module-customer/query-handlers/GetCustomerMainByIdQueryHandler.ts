import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { GetCustomerMainByIdQuery } from '../queries/index.js'
import { CustomerMain } from '../../types/customer.js'

@QueryHandler(GetCustomerMainByIdQuery)
export class GetCustomerMainByIdQueryHandler implements IQueryHandler<GetCustomerMainByIdQuery> {
  constructor(private repository: CustomerMainProjection) {}

  async execute(query: GetCustomerMainByIdQuery): Promise<CustomerMain> {
    return this.repository.getById(query.id)
  }
}
