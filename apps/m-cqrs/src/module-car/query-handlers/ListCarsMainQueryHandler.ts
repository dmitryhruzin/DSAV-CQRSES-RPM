import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { ListCarsMainQuery } from '../queries/index.js'
import { CarMain } from '../../types/car.js'
import { Paginated } from '../../types/common.js'

@QueryHandler(ListCarsMainQuery)
export class ListCarsMainQueryHandler implements IQueryHandler<ListCarsMainQuery> {
  constructor(private repository: CarMainProjection) {}

  async execute(query: ListCarsMainQuery): Promise<Paginated<CarMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
