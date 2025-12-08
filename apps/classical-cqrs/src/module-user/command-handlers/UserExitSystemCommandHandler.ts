import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { UserExitSystemCommand } from '../commands/index.js'
import { UserRepository } from '../user.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(UserExitSystemCommand)
export class UserExitSystemCommandHandler implements ICommandHandler<UserExitSystemCommand> {
  constructor(
    private repository: UserRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: UserExitSystemCommand): Promise<string> {
    const userAggregate = this.publisher.mergeObjectContext(await this.repository.buildUserAggregate(command.id))

    const events = userAggregate.exitSystem()
    await this.repository.save(userAggregate, events)

    userAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
