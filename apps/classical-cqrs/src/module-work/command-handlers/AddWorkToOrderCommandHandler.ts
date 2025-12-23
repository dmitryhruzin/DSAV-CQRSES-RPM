import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { AddWorkToOrderCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'
import { OrderRepository } from '../../module-order/order.repository.js'

@CommandHandler(AddWorkToOrderCommand)
export class AddWorkToOrderCommandHandler implements ICommandHandler<AddWorkToOrderCommand> {
  constructor(
    private repository: WorkRepository,
    private orderRepository: OrderRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: AddWorkToOrderCommand): Promise<string> {
    const orderAggregate = this.publisher.mergeObjectContext(
      await this.orderRepository.buildOrderAggregate(command.orderID)
    )
    if (!orderAggregate.version) {
      throw new Error(`Order with ID ${command.orderID} does not exist`)
    }

    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate(command.id))
    if (!workAggregate.version) {
      throw new Error(`Work with ID ${command.id} does not exist`)
    }

    const events = workAggregate.addToOrder(command)
    await this.repository.save(workAggregate, events)
    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
