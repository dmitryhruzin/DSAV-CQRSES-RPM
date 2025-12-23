import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { UnassignWorkFromWorkerCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(UnassignWorkFromWorkerCommand)
export class UnassignWorkFromWorkerCommandHandler implements ICommandHandler<UnassignWorkFromWorkerCommand> {
  constructor(
    private repository: WorkRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: UnassignWorkFromWorkerCommand): Promise<string> {
    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate(command.id))

    if (!workAggregate.version) {
      throw new Error(`Work with ID ${command.id} does not exist`)
    }

    const events = workAggregate.unassignFromWorker()
    await this.repository.save(workAggregate, events)
    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
