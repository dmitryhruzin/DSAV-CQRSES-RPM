import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ChangeUserPasswordCommand } from '../commands/index.js'
import { UserRepository } from '../user.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(ChangeUserPasswordCommand)
export class ChangeUserPasswordCommandHandler implements ICommandHandler<ChangeUserPasswordCommand> {
  constructor(
    private repository: UserRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ChangeUserPasswordCommand): Promise<string> {
    const userAggregate = this.publisher.mergeObjectContext(await this.repository.buildUserAggregate(command.id))

    const events = userAggregate.changePassword(command)
    await this.repository.save(userAggregate, events)

    userAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
