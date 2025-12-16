import { Controller, HttpCode, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { Paginated, AcknowledgementResponse } from '../types/common.js'
import {
  ChangeWorkerHourlyRateRequest,
  ChangeWorkerRolerRequest,
  HireWorkerRequest,
  WorkerMain
} from '../types/worker.js'
import {
  HireWorkerCommand,
  ChangeWorkerRoleCommand,
  ChangeWorkerHourlyRateCommand,
  DismissWorkerCommand
} from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/common.js'
import { ListWorkersMainQuery, GetWorkerMainByIdQuery } from './queries/index.js'

@Controller('/workers')
export class WorkerController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/')
  @HttpCode(200)
  async hire(@Body() payload: HireWorkerRequest): Promise<AcknowledgementResponse> {
    const { hourlyRate, role } = payload

    if (!hourlyRate || hourlyRate.trim() === '') {
      throw new Error('Hourly rate must be a non-empty string')
    }
    if (!role || role.trim() === '') {
      throw new Error('Role must be a non-empty string')
    }

    const command = new HireWorkerCommand({ hourlyRate, role })
    return this.commandBus.execute(command)
  }

  @Patch('/change-role')
  @HttpCode(200)
  async changeRole(@Body() payload: ChangeWorkerRolerRequest): Promise<AcknowledgementResponse> {
    const { id, role } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!role || role.trim() === '') {
      throw new Error('Role must be a non-empty string')
    }

    const command = new ChangeWorkerRoleCommand({ id, role })
    return this.commandBus.execute(command)
  }

  @Patch('/change-hourly-rate')
  @HttpCode(200)
  async changeHourlyRate(@Body() payload: ChangeWorkerHourlyRateRequest): Promise<AcknowledgementResponse> {
    const { id, hourlyRate } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!hourlyRate || hourlyRate.trim() === '') {
      throw new Error('Hourly rate must be a non-empty string')
    }

    const command = new ChangeWorkerHourlyRateCommand({ id, hourlyRate })
    return this.commandBus.execute(command)
  }

  @Delete('/:id')
  @HttpCode(200)
  async dismiss(@Param('id') id: string): Promise<AcknowledgementResponse> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new DismissWorkerCommand({ id })
    return this.commandBus.execute(command)
  }

  @Get('/')
  async listWorkersMain(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number
  ): Promise<Paginated<WorkerMain>> {
    const validatedPageSize = pageSize && pageSize > 0 ? Math.min(pageSize, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
    return this.queryBus.execute(new ListWorkersMainQuery(page || PAGE_DEFAULT, validatedPageSize))
  }

  @Get('/:id')
  async getWorkerMainById(@Param('id') id: string): Promise<WorkerMain> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetWorkerMainByIdQuery(id))
  }
}
