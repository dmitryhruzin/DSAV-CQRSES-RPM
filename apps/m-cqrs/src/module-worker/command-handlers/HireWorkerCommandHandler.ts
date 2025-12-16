import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { HireWorkerCommand } from '../commands/index.js'
import { WorkerRepository } from '../worker.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(HireWorkerCommand)
export class HireWorkerCommandHandler implements ICommandHandler<HireWorkerCommand> {
  constructor(
    private repository: WorkerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: HireWorkerCommand): Promise<string> {
    const workerAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkerAggregate())

    const events = workerAggregate.hire(command)
    await this.repository.save(workerAggregate, events)

    workerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
