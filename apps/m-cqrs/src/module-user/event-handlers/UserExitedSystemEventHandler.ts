import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { UserExitedSystemV1 } from '../events/index.js'
import { UserMainProjection } from '../projections/user-main.projection.js'

@EventsHandler(UserExitedSystemV1)
export class UserExitedSystemEventHandler implements IEventHandler<UserExitedSystemV1> {
  constructor(private repository: UserMainProjection) {}

  async handle(event: UserExitedSystemV1) {
    await this.repository.update(event.aggregateId, {
      isInSystem: false,
      version: event.aggregateVersion
    })
  }
}
