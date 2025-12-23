import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { WorkMainProjection } from '../projections/work-main.projection.js'
import { ListWorkMainQuery } from '../queries/index.js'
import { Paginated } from '../../types/common.js'
import { WorkMain } from '../../types/work.js'

@QueryHandler(ListWorkMainQuery)
export class ListWorkMainQueryHandler implements IQueryHandler<ListWorkMainQuery> {
  constructor(private repository: WorkMainProjection) {}

  async execute(query: ListWorkMainQuery): Promise<Paginated<WorkMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
