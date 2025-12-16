import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { ListWorkersMainQuery } from '../queries/index.js'
import { Paginated } from '../../types/common.js'
import { WorkerMain } from '../../types/worker.js'

@QueryHandler(ListWorkersMainQuery)
export class ListWorkersMainQueryHandler implements IQueryHandler<ListWorkersMainQuery> {
  constructor(private repository: WorkerMainProjection) {}

  async execute(query: ListWorkersMainQuery): Promise<Paginated<WorkerMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
