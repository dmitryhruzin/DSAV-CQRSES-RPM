import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { ChangeWorkerHourlyRateCommand } from '../commands/index.js'
import { WorkerRepository } from '../worker.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(ChangeWorkerHourlyRateCommand)
export class ChangeWorkerHourlyRateCommandHandler implements ICommandHandler<ChangeWorkerHourlyRateCommand> {
  constructor(
    private repository: WorkerRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: ChangeWorkerHourlyRateCommand): Promise<string> {
    const workerAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkerAggregate(command.id))

    if (!workerAggregate.version) {
      throw new Error(`Worker with ID ${command.id} does not exist`)
    }

    const events = workerAggregate.changeHourlyRate(command)
    await this.repository.save(workerAggregate, events)
    workerAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
