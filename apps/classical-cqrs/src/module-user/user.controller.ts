import { Controller, HttpCode, Post, Patch, Get, Body, Param } from "@nestjs/common";
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { AcknowledgementResponse } from '../types/common.js'
import { CreateUserRequest, ChangeUserPasswordRequest, UserEnterSystemRequest } from '../types/user.js'
import { CreateUserCommand, ChangeUserPasswordCommand, UserEnterSystemCommand } from './commands/index.js'

@Controller('/users')
export class UserController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/create')
  @HttpCode(200)
  async create(@Body() payload: CreateUserRequest): Promise<AcknowledgementResponse> {
    const { password } = payload

    if (!password || password.trim() === '') {
      throw new Error('Password must be a non-empty string')
    }

    const command = new CreateUserCommand({ password })
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
}