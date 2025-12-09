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
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/common.js'

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

    const command = new CreateUserCommand(payload)
    return this.commandBus.execute(command)
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

    const command = new ChangeUserPasswordCommand({ id, newPassword })
    return this.commandBus.execute(command)
  }

  @Patch('/enter-system')
  @HttpCode(200)
  async enterSystem(@Body() payload: UserEnterSystemRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('User ID must be a non-empty string')
    }

    const command = new UserEnterSystemCommand({ id })
    return this.commandBus.execute(command)
  }

  @Patch('/exit-system')
  @HttpCode(200)
  async exitSystem(@Body() payload: UserExitSystemRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('User ID must be a non-empty string')
    }

    const command = new UserExitSystemCommand({ id })
    return this.commandBus.execute(command)
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
