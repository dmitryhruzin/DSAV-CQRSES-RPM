import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { DeleteCustomerCommand } from '../commands/index.js'
import { CustomerRepository } from '../customer.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(DeleteCustomerCommand)
export class DeleteCustomerCommandHandler implements ICommandHandler<DeleteCustomerCommand> {
  constructor(
    private repository: CustomerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: DeleteCustomerCommand): Promise<string> {
    const customerAggregate = this.publisher.mergeObjectContext(
      await this.repository.buildCustomerAggregate(command.id)
    )

    if (!customerAggregate.version) {
      throw new Error(`Customer with ID ${command.id} does not exist`)
    }

    const events = customerAggregate.delete()
    await this.repository.save(customerAggregate, events)

    customerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
