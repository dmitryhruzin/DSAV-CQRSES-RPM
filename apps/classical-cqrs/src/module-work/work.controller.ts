import { Controller, HttpCode, Get, Post, Patch, Body, Param, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { Paginated, AcknowledgementResponse } from '../types/common.js'
import {
  ChangeWorkTitleRequest,
  CreateWorkRequest,
  ChangeWorkDescriptionRequest,
  SetWorkEstimateRequest,
  StartWorkRequest,
  PauseWorkRequest,
  ResumeWorkRequest,
  CompleteWorkRequest,
  CancelWorkRequest,
  AssignWorkToWorkerRequest,
  UnassignWorkFromWorkerRequest,
  WorkMain,
  AddWorkToOrderRequest,
  RemoveWorkFromOrderRequest
} from '../types/work.js'
import {
  ChangeWorkDescriptionCommand,
  ChangeWorkTitleCommand,
  CreateWorkCommand,
  SetWorkEstimateCommand,
  StartWorkCommand,
  PauseWorkCommand,
  ResumeWorkCommand,
  CompleteWorkCommand,
  CancelWorkCommand,
  AssignWorkToWorkerCommand,
  UnassignWorkFromWorkerCommand,
  AddWorkToOrderCommand,
  RemoveWorkFromOrderCommand
} from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, ackOk } from '../constants/common.js'
import { ListWorkMainQuery, GetWorkMainByIdQuery } from './queries/index.js'

const AGGREGATE_TYPE = 'Work'

@Controller('/work')
export class WorkController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/')
  @HttpCode(200)
  async create(@Body() payload: CreateWorkRequest): Promise<AcknowledgementResponse> {
    const { title, description } = payload

    if (!title || title.trim() === '') {
      throw new Error('Title must be a non-empty string')
    }
    if (!description || description.trim() === '') {
      throw new Error('Description must be a non-empty string')
    }

    const id = await this.commandBus.execute<CreateWorkCommand, string>(new CreateWorkCommand({ title, description }))
    return ackOk(id, AGGREGATE_TYPE)
  }

  @Patch('/change-title')
  @HttpCode(200)
  async changeTitle(@Body() payload: ChangeWorkTitleRequest): Promise<AcknowledgementResponse> {
    const { id, title } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!title || title.trim() === '') {
      throw new Error('Title must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ChangeWorkTitleCommand, string>(
      new ChangeWorkTitleCommand({ id, title })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/change-description')
  @HttpCode(200)
  async changeDescription(@Body() payload: ChangeWorkDescriptionRequest): Promise<AcknowledgementResponse> {
    const { id, description } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!description || description.trim() === '') {
      throw new Error('Description must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ChangeWorkDescriptionCommand, string>(
      new ChangeWorkDescriptionCommand({ id, description })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/set-estimate')
  @HttpCode(200)
  async setEstimate(@Body() payload: SetWorkEstimateRequest): Promise<AcknowledgementResponse> {
    const { id, estimate } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!estimate || estimate.trim() === '') {
      throw new Error('Estimate must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<SetWorkEstimateCommand, string>(
      new SetWorkEstimateCommand({ id, estimate })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/start')
  @HttpCode(200)
  async start(@Body() payload: StartWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<StartWorkCommand, string>(new StartWorkCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/pause')
  @HttpCode(200)
  async pause(@Body() payload: PauseWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<PauseWorkCommand, string>(new PauseWorkCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/resume')
  @HttpCode(200)
  async resume(@Body() payload: ResumeWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ResumeWorkCommand, string>(new ResumeWorkCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/complete')
  @HttpCode(200)
  async complete(@Body() payload: CompleteWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<CompleteWorkCommand, string>(new CompleteWorkCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/cancel')
  @HttpCode(200)
  async cancel(@Body() payload: CancelWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<CancelWorkCommand, string>(new CancelWorkCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/assign-to-worker')
  @HttpCode(200)
  async assignToWorker(@Body() payload: AssignWorkToWorkerRequest): Promise<AcknowledgementResponse> {
    const { id, workerID } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!workerID || workerID.trim() === '') {
      throw new Error('WorkerID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<AssignWorkToWorkerCommand, string>(
      new AssignWorkToWorkerCommand({ id, workerID })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/unassign-from-worker')
  @HttpCode(200)
  async unassignFromWorker(@Body() payload: UnassignWorkFromWorkerRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<UnassignWorkFromWorkerCommand, string>(
      new UnassignWorkFromWorkerCommand({ id })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/add-to-order')
  @HttpCode(200)
  async addToOrder(@Body() payload: AddWorkToOrderRequest): Promise<AcknowledgementResponse> {
    const { id, orderID } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!orderID || orderID.trim() === '') {
      throw new Error('OrderID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<AddWorkToOrderCommand, string>(
      new AddWorkToOrderCommand({ id, orderID })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/remove-from-order')
  @HttpCode(200)
  async removeFromOrder(@Body() payload: RemoveWorkFromOrderRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<RemoveWorkFromOrderCommand, string>(
      new RemoveWorkFromOrderCommand({ id })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Get('/')
  async listWorkMain(@Query('page') page: number, @Query('pageSize') pageSize: number): Promise<Paginated<WorkMain>> {
    const validatedPageSize = pageSize && pageSize > 0 ? Math.min(pageSize, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
    return this.queryBus.execute(new ListWorkMainQuery(page || PAGE_DEFAULT, validatedPageSize))
  }

  @Get('/:id')
  async getWorkMainById(@Param('id') id: string): Promise<WorkMain> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetWorkMainByIdQuery(id))
  }
}
