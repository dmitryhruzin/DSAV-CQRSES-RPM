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
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/common.js'
import { ListWorkMainQuery, GetWorkMainByIdQuery } from './queries/index.js'

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

    const command = new CreateWorkCommand({ title, description })
    return this.commandBus.execute(command)
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

    const command = new ChangeWorkTitleCommand({ id, title })
    return this.commandBus.execute(command)
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

    const command = new ChangeWorkDescriptionCommand({ id, description })
    return this.commandBus.execute(command)
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

    const command = new SetWorkEstimateCommand({ id, estimate })
    return this.commandBus.execute(command)
  }

  @Patch('/start')
  @HttpCode(200)
  async start(@Body() payload: StartWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new StartWorkCommand({ id })
    return this.commandBus.execute(command)
  }

  @Patch('/pause')
  @HttpCode(200)
  async pause(@Body() payload: PauseWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new PauseWorkCommand({ id })
    return this.commandBus.execute(command)
  }

  @Patch('/resume')
  @HttpCode(200)
  async resume(@Body() payload: ResumeWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new ResumeWorkCommand({ id })
    return this.commandBus.execute(command)
  }

  @Patch('/complete')
  @HttpCode(200)
  async complete(@Body() payload: CompleteWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new CompleteWorkCommand({ id })
    return this.commandBus.execute(command)
  }

  @Patch('/cancel')
  @HttpCode(200)
  async cancel(@Body() payload: CancelWorkRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new CancelWorkCommand({ id })
    return this.commandBus.execute(command)
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

    const command = new AssignWorkToWorkerCommand({ id, workerID })
    return this.commandBus.execute(command)
  }

  @Patch('/unassign-from-worker')
  @HttpCode(200)
  async unassignFromWorker(@Body() payload: UnassignWorkFromWorkerRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new UnassignWorkFromWorkerCommand({ id })
    return this.commandBus.execute(command)
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

    const command = new AddWorkToOrderCommand({ id, orderID })
    return this.commandBus.execute(command)
  }

  @Patch('/remove-from-order')
  @HttpCode(200)
  async removeFromOrder(@Body() payload: RemoveWorkFromOrderRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new RemoveWorkFromOrderCommand({ id })
    return this.commandBus.execute(command)
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
