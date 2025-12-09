import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { UserEnteredSystemV1 } from '../events/index.js'
import { UserMainProjection } from '../projections/user-main.projection.js'

@EventsHandler(UserEnteredSystemV1)
export class UserEnteredSystemEventHandler implements IEventHandler<UserEnteredSystemV1> {
  constructor(private repository: UserMainProjection) {}

  async handle(event: UserEnteredSystemV1) {
    await this.repository.update(event.aggregateId, {
      isInSystem: true,
      version: event.aggregateVersion
    })
  }
}
