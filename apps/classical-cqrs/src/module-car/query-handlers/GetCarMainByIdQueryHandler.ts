import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { CarMainProjection } from '../projections/car-main.projection.js'
import { GetCarMainByIdQuery } from '../queries/index.js'
import { CarMain } from '../../types/car.js'

@QueryHandler(GetCarMainByIdQuery)
export class GetCarMainByIdQueryHandler implements IQueryHandler<GetCarMainByIdQuery> {
  constructor(private repository: CarMainProjection) {}

  async execute(query: GetCarMainByIdQuery): Promise<CarMain> {
    return this.repository.getById(query.id)
  }
}
