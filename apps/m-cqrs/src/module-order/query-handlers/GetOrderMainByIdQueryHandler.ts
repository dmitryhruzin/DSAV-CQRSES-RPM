import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { OrderMainProjection } from '../projections/order-main.projection.js'
import { GetOrderMainByIdQuery } from '../queries/index.js'
import { OrderMain } from '../../types/order.js'

@QueryHandler(GetOrderMainByIdQuery)
export class GetOrderMainByIdQueryHandler implements IQueryHandler<GetOrderMainByIdQuery> {
  constructor(private repository: OrderMainProjection) {}

  async execute(query: GetOrderMainByIdQuery): Promise<OrderMain> {
    return this.repository.getById(query.id)
  }
}
