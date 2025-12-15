import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { DeleteCarCommand } from '../commands/index.js'
import { CarRepository } from '../car.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(DeleteCarCommand)
export class DeleteCarCommandHandler implements ICommandHandler<DeleteCarCommand> {
  constructor(
    private repository: CarRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: DeleteCarCommand): Promise<string> {
    const carAggregate = this.publisher.mergeObjectContext(await this.repository.buildCarAggregate(command.id))

    if (!carAggregate.version) {
      throw new Error(`Car with ID ${command.id} does not exist`)
    }

    const events = carAggregate.delete()
    await this.repository.save(carAggregate, events)

    carAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
