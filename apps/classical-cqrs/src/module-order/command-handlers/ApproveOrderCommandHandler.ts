import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ApproveOrderCommand } from '../commands/index.js'
import { OrderRepository } from '../order.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(ApproveOrderCommand)
export class ApproveOrderCommandHandler implements ICommandHandler<ApproveOrderCommand> {
  constructor(
    private repository: OrderRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ApproveOrderCommand): Promise<string> {
    const orderAggregate = this.publisher.mergeObjectContext(await this.repository.buildOrderAggregate(command.id))

    if (!orderAggregate.version) {
      throw new Error(`Order with ID ${command.id} does not exist`)
    }

    const events = orderAggregate.approve()
    await this.repository.save(orderAggregate, events)
    orderAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
