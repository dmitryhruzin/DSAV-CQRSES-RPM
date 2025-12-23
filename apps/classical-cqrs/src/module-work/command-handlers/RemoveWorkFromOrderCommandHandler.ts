import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { RemoveWorkFromOrderCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(RemoveWorkFromOrderCommand)
export class RemoveWorkFromOrderCommandHandler implements ICommandHandler<RemoveWorkFromOrderCommand> {
  constructor(
    private repository: WorkRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: RemoveWorkFromOrderCommand): Promise<string> {
    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate(command.id))
    if (!workAggregate.version) {
      throw new Error(`Work with ID ${command.id} does not exist`)
    }

    const events = workAggregate.removeFromOrder()
    await this.repository.save(workAggregate, events)
    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
