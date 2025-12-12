import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { CustomerMainProjection } from '../projections/customer-main.projection.js'
import { ListCustomersMainQuery } from '../queries/index.js'
import { CustomerMain } from '../../types/customer.js'
import { Paginated } from '../../types/common.js'

@QueryHandler(ListCustomersMainQuery)
export class ListCustomersMainQueryHandler implements IQueryHandler<ListCustomersMainQuery> {
  constructor(private repository: CustomerMainProjection) {}

  async execute(query: ListCustomersMainQuery): Promise<Paginated<CustomerMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
