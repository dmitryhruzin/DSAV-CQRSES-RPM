import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { StartWorkCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(StartWorkCommand)
export class StartWorkCommandHandler implements ICommandHandler<StartWorkCommand> {
  constructor(
    private repository: WorkRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: StartWorkCommand): Promise<string> {
    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate(command.id))

    if (!workAggregate.version) {
      throw new Error(`Work with ID ${command.id} does not exist`)
    }

    const events = workAggregate.start()
    await this.repository.save(workAggregate, events)
    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
