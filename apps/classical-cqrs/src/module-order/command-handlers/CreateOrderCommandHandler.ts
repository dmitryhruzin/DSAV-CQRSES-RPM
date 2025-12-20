import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { CreateOrderCommand } from '../commands/index.js'
import { OrderRepository } from '../order.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private repository: OrderRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: CreateOrderCommand): Promise<string> {
    const orderAggregate = this.publisher.mergeObjectContext(await this.repository.buildOrderAggregate())

    const events = orderAggregate.create(command)
    await this.repository.save(orderAggregate, events)

    orderAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
