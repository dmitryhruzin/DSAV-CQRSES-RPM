import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { CreateCustomerCommand } from '../commands/index.js'
import { CustomerRepository } from '../customer.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'
import { UserRepository } from '../../module-user/user.repository.js'

@CommandHandler(CreateCustomerCommand)
export class CreateCustomerCommandHandler implements ICommandHandler<CreateCustomerCommand> {
  constructor(
    private repository: CustomerRepository,
    private userRepository: UserRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: CreateCustomerCommand): Promise<string> {
    const userAggregate = await this.userRepository.buildUserAggregate(command.userID)
    if (!userAggregate.version) {
      throw new Error(`User with ID ${command.userID} does not exist`)
    }

    const customerAggregate = this.publisher.mergeObjectContext(await this.repository.buildCustomerAggregate())

    const events = customerAggregate.create(command)
    await this.repository.save(customerAggregate, events)

    customerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
