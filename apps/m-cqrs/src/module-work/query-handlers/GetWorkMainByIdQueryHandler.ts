import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { GetWorkMainByIdQuery } from '../queries/index.js'
import { WorkMain } from '../../types/work.js'

@QueryHandler(GetWorkMainByIdQuery)
export class GetWorkMainByIdQueryHandler implements IQueryHandler<GetWorkMainByIdQuery> {
  constructor(private repository: WorkMainProjection) {}

  async execute(query: GetWorkMainByIdQuery): Promise<WorkMain> {
    return this.repository.getById(query.id)
  }
}
