import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { SetOrderPriorityCommand } from '../commands/index.js'
import { OrderRepository } from '../order.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(SetOrderPriorityCommand)
export class SetOrderPriorityCommandHandler implements ICommandHandler<SetOrderPriorityCommand> {
  constructor(
    private repository: OrderRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: SetOrderPriorityCommand): Promise<string> {
    const orderAggregate = this.publisher.mergeObjectContext(await this.repository.buildOrderAggregate(command.id))

    if (!orderAggregate.version) {
      throw new Error(`Order with ID ${command.id} does not exist`)
    }

    const events = orderAggregate.setPriority(command)
    await this.repository.save(orderAggregate, events)
    orderAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
