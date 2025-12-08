import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { ListUserMainQuery } from '../queries/index.js'
import { UserMain } from '../../types/user.js'
import { Paginated } from '../../types/common.js'

@QueryHandler(ListUserMainQuery)
export class ListUserMainQueryHandler implements IQueryHandler<ListUserMainQuery> {
  constructor(private repository: UserMainProjection) {}

  async execute(query: ListUserMainQuery): Promise<Paginated<UserMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
