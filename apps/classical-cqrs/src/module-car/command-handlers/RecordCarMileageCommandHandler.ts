import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { RecordCarMileageCommand } from '../commands/index.js'
import { CarRepository } from '../car.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(RecordCarMileageCommand)
export class RecordCarMileageCommandHandler implements ICommandHandler<RecordCarMileageCommand> {
  constructor(
    private repository: CarRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: RecordCarMileageCommand): Promise<string> {
    const carAggregate = this.publisher.mergeObjectContext(await this.repository.buildCarAggregate(command.id))

    console.log('carAggregate.version', carAggregate.version)
    if (!carAggregate.version) {
      throw new Error(`Car with ID ${command.id} does not exist`)
    }

    const events = carAggregate.recordMileage(command)
    await this.repository.save(carAggregate, events)

    carAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
