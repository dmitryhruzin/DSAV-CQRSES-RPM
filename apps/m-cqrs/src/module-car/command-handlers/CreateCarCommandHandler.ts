import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { CreateCarCommand } from '../commands/index.js'
import { CarRepository } from '../car.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'
import { CustomerRepository } from '../../module-customer/customer.repository.js'

@CommandHandler(CreateCarCommand)
export class CreateCarCommandHandler implements ICommandHandler<CreateCarCommand> {
  constructor(
    private repository: CarRepository,
    private customerRepository: CustomerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: CreateCarCommand): Promise<string> {
    const customerAggregate = await this.customerRepository.buildCustomerAggregate(command.ownerID)
    if (!customerAggregate.version) {
      throw new Error(`Customer with ID ${command.ownerID} does not exist`)
    }

    const carAggregate = this.publisher.mergeObjectContext(await this.repository.buildCarAggregate())

    const events = carAggregate.create(command)
    await this.repository.save(carAggregate, events)

    carAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
