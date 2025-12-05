import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { UserCreatedV1 } from '../events/index.js'
import { UserMainProjection } from '../projections/user-main.projection.js'

@EventsHandler(UserCreatedV1)
export class UserCreatedEventHandler implements IEventHandler<UserCreatedV1> {
  constructor(private repository: UserMainProjection) {}

  async handle(event: UserCreatedV1) {
    await this.repository.save(event.toJson())
  }
}
