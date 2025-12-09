import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { UserMainProjection } from '../projections/user-main.projection.js'
import { ListUsersMainQuery } from '../queries/index.js'
import { UserMain } from '../../types/user.js'
import { Paginated } from '../../types/common.js'

@QueryHandler(ListUsersMainQuery)
export class ListUsersMainQueryHandler implements IQueryHandler<ListUsersMainQuery> {
  constructor(private repository: UserMainProjection) {}

  async execute(query: ListUsersMainQuery): Promise<Paginated<UserMain>> {
    const { page, pageSize } = query
    return this.repository.getAll(page, pageSize)
  }
}
