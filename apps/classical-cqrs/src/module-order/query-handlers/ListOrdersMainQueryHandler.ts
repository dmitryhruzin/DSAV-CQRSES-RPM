import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { ListOrdersMainQuery } from '../queries/index.js'
import { Paginated } from '../../types/common.js'
import { OrderMain } from '../../types/order.js'

@QueryHandler(ListOrdersMainQuery)
export class ListOrdersMainQueryHandler implements IQueryHandler<ListOrdersMainQuery> {
  constructor(private repository: OrderMainProjection) {}

  async execute(query: ListOrdersMainQuery): Promise<Paginated<OrderMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
