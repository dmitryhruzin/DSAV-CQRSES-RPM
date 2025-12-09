import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { GetUserMainByIdQuery } from '../queries/index.js'
import { UserMain } from '../../types/user.js'

@QueryHandler(GetUserMainByIdQuery)
export class GetUserMainByIdQueryHandler implements IQueryHandler<GetUserMainByIdQuery> {
  constructor(private repository: UserMainProjection) {}

  execute(query: GetUserMainByIdQuery): Promise<UserMain> {
    return this.repository.getById(query.id)
  }
}
