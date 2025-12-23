import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { AssignWorkToWorkerCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'
import { WorkerRepository } from '../../module-worker/worker.repository.js'

@CommandHandler(AssignWorkToWorkerCommand)
export class AssignWorkToWorkerCommandHandler implements ICommandHandler<AssignWorkToWorkerCommand> {
  constructor(
    private repository: WorkRepository,
    private workerRepository: WorkerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: AssignWorkToWorkerCommand): Promise<string> {
    const workerAggregate = this.publisher.mergeObjectContext(
      await this.workerRepository.buildWorkerAggregate(command.workerID)
    )
    if (!workerAggregate.version) {
      throw new Error(`Worker with ID ${command.workerID} does not exist`)
    }

    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate(command.id))
    if (!workAggregate.version) {
      throw new Error(`Work with ID ${command.id} does not exist`)
    }

    const events = workAggregate.assignToWorker(command)
    await this.repository.save(workAggregate, events)
    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
