import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs'
import { CreateWorkCommand } from '../commands/index.js'
import { WorkRepository } from '../work.repository.js'
import { ACKNOWLEDGEMENT_OK } from '../../constants/common.js'

@CommandHandler(CreateWorkCommand)
export class CreateWorkCommandHandler implements ICommandHandler<CreateWorkCommand> {
  constructor(
    private repository: WorkRepository,
    private publisher: EventPublisher
  ) {}

  async execute(command: CreateWorkCommand): Promise<string> {
    const workAggregate = this.publisher.mergeObjectContext(await this.repository.buildWorkAggregate())

    const events = workAggregate.create(command)
    await this.repository.save(workAggregate, events)

    workAggregate.commit()

    return ACKNOWLEDGEMENT_OK
  }
}
