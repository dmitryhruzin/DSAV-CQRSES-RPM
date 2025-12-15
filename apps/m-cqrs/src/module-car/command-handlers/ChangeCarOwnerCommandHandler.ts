import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ChangeCarOwnerCommand } from '../commands/index.js'
import { CarRepository } from '../car.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'
import { CustomerRepository } from '../../module-customer/customer.repository.js'

@CommandHandler(ChangeCarOwnerCommand)
export class ChangeCarOwnerCommandHandler implements ICommandHandler<ChangeCarOwnerCommand> {
  constructor(
    private repository: CarRepository,
    private customerRepository: CustomerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ChangeCarOwnerCommand): Promise<string> {
    const customerAggregate = await this.customerRepository.buildCustomerAggregate(command.ownerID)
    if (!customerAggregate.version) {
      throw new Error(`Customer with ID ${command.ownerID} does not exist`)
    }

    const carAggregate = this.publisher.mergeObjectContext(await this.repository.buildCarAggregate(command.id))

    if (!carAggregate.version) {
      throw new Error(`Car with ID ${command.id} does not exist`)
    }

    const events = carAggregate.changeOwner(command)
    await this.repository.save(carAggregate, events)

    carAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
