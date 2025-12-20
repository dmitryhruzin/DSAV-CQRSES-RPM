import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ApplyDiscountToOrderCommand } from '../commands/index.js'
import { OrderRepository } from '../order.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(ApplyDiscountToOrderCommand)
export class ApplyDiscountToOrderCommandHandler implements ICommandHandler<ApplyDiscountToOrderCommand> {
  constructor(
    private repository: OrderRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ApplyDiscountToOrderCommand): Promise<string> {
    const orderAggregate = this.publisher.mergeObjectContext(await this.repository.buildOrderAggregate(command.id))

    if (!orderAggregate.version) {
      throw new Error(`Order with ID ${command.id} does not exist`)
    }

    const events = orderAggregate.applyDiscount(command)
    await this.repository.save(orderAggregate, events)
    orderAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
