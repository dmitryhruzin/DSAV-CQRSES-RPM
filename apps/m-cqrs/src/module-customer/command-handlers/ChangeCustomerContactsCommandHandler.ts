import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ChangeCustomerContactsCommand } from '../commands/index.js'
import { CustomerRepository } from '../customer.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(ChangeCustomerContactsCommand)
export class ChangeCustomerContactsCommandHandler implements ICommandHandler<ChangeCustomerContactsCommand> {
  constructor(
    private repository: CustomerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ChangeCustomerContactsCommand): Promise<string> {
    const customerAggregate = this.publisher.mergeObjectContext(
      await this.repository.buildCustomerAggregate(command.id)
    )

    if (!customerAggregate.version) {
      throw new Error(`Customer with ID ${command.id} does not exist`)
    }

    const events = customerAggregate.changeContacts(command)
    await this.repository.save(customerAggregate, events)

    customerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
