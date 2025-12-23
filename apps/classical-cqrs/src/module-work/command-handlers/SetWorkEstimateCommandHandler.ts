import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { SetWorkEstimateCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(SetWorkEstimateCommand)
export class SetWorkEstimateCommandHandler implements ICommandHandler<SetWorkEstimateCommand> {
  constructor(
    private repository: WorkRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: SetWorkEstimateCommand): Promise<string> {
    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate(command.id))

    if (!workAggregate.version) {
      throw new Error(`Work with ID ${command.id} does not exist`)
    }

    const events = workAggregate.setEstimate(command)
    await this.repository.save(workAggregate, events)
    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
