import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { WorkerMainProjection } from '../projections/worker-main.projection.js'
import { GetWorkerMainByIdQuery } from '../queries/index.js'
import { WorkerMain } from '../../types/worker.js'

@QueryHandler(GetWorkerMainByIdQuery)
export class GetWorkerMainByIdQueryHandler implements IQueryHandler<GetWorkerMainByIdQuery> {
  constructor(private repository: WorkerMainProjection) {}

  async execute(query: GetWorkerMainByIdQuery): Promise<WorkerMain> {
    return this.repository.getById(query.id)
  }
}
