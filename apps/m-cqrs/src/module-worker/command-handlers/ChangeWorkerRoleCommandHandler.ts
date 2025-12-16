import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ChangeWorkerRoleCommand } from '../commands/index.js'
import { WorkerRepository } from '../worker.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(ChangeWorkerRoleCommand)
export class ChangeWorkerRoleCommandHandler implements ICommandHandler<ChangeWorkerRoleCommand> {
  constructor(
    private repository: WorkerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ChangeWorkerRoleCommand): Promise<string> {
    const workerAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkerAggregate(command.id))

    if (!workerAggregate.version) {
      throw new Error(`Worker with ID ${command.id} does not exist`)
    }

    const events = workerAggregate.changeRole(command)
    await this.repository.save(workerAggregate, events)
    workerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
