import { Controller, HttpCode, Post, Patch, Get, Body, Param, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { AcknowledgementResponse } from '../types/common.js'
import {
  CreateUserRequest,
  ChangeUserPasswordRequest,
  UserMain,
  UserEnterSystemRequest,
  UserExitSystemRequest
} from '../types/user.js'
import {
  CreateUserCommand,
  ChangeUserPasswordCommand,
  UserEnterSystemCommand,
  UserExitSystemCommand
} from './commands/index.js'
import { GetUserMainByIdQuery, ListUsersMainQuery } from './queries/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, ackOk } from '../constants/common.js'

const AGGREGATE_TYPE = 'User'

@Controller('/users')
export class UserController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/')
  @HttpCode(200)
  async createUser(@Body() payload: CreateUserRequest): Promise<AcknowledgementResponse> {
    if (!payload.password || payload.password.trim() === '') {
      throw new Error('Password must be a non-empty string')
    }

    const id = await this.commandBus.execute<CreateUserCommand, string>(new CreateUserCommand(payload))
    return ackOk(id, AGGREGATE_TYPE)
  }

  @Patch('/change-password')
  @HttpCode(200)
  async changePassword(@Body() payload: ChangeUserPasswordRequest): Promise<AcknowledgementResponse> {
    const { id, newPassword } = payload

    if (!id || id.trim() === '') {
      throw new Error('User ID must be a non-empty string')
    }
    if (!newPassword || newPassword.trim() === '') {
      throw new Error('Password must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ChangeUserPasswordCommand, string>(
      new ChangeUserPasswordCommand({ id, newPassword })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/enter-system')
  @HttpCode(200)
  async enterSystem(@Body() payload: UserEnterSystemRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('User ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<UserEnterSystemCommand, string>(
      new UserEnterSystemCommand({ id })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/exit-system')
  @HttpCode(200)
  async exitSystem(@Body() payload: UserExitSystemRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('User ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<UserExitSystemCommand, string>(new UserExitSystemCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Get('/')
  async listUsersMain(@Query('page') page: number, @Query('pageSize') pageSize: number): Promise<UserMain[]> {
    const validatedPageSize = pageSize && pageSize > 0 ? Math.min(pageSize, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
    return this.queryBus.execute(new ListUsersMainQuery(page || PAGE_DEFAULT, validatedPageSize))
  }

  @Get('/:id')
  async getUserMainById(@Param('id') id: string): Promise<UserMain> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetUserMainByIdQuery(id))
  }
}
