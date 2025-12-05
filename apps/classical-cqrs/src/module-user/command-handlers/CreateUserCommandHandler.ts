import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { CreateUserCommand } from '../commands/index.js'
import { UserRepository } from '../user.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private repository: UserRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const userAggregate = this.publisher.mergeObjectContext(await this.repository.buildUserAggregate())

    const events = userAggregate.create(command)
    await this.repository.save(userAggregate, events)

    userAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
