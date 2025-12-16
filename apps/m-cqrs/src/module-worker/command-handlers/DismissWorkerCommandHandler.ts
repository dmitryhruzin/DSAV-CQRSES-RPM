import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { DismissWorkerCommand } from '../commands/index.js'
import { WorkerRepository } from '../worker.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(DismissWorkerCommand)
export class DismissWorkerCommandHandler implements ICommandHandler<DismissWorkerCommand> {
  constructor(
    private repository: WorkerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: DismissWorkerCommand): Promise<string> {
    const workerAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkerAggregate(command.id))

    if (!workerAggregate.version) {
      throw new Error(`Worker with ID ${command.id} does not exist`)
    }

    const events = workerAggregate.dismiss()
    await this.repository.save(workerAggregate, events)
    workerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
