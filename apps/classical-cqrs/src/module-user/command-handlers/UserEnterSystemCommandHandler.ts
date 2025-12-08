import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { UserEnterSystemCommand } from '../commands/index.js'
import { UserRepository } from '../user.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(UserEnterSystemCommand)
export class UserEnterSystemCommandHandler implements ICommandHandler<UserEnterSystemCommand> {
  constructor(
    private repository: UserRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: UserEnterSystemCommand): Promise<string> {
    const userAggregate = this.publisher.mergeObjectContext(await this.repository.buildUserAggregate(command.id))

    const events = userAggregate.enterSystem()
    await this.repository.save(userAggregate, events)

    userAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
