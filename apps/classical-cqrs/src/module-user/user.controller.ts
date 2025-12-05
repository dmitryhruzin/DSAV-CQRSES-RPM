import { Controller, HttpCode, Post, Get, Body, Param } from "@nestjs/common";
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { AcknowledgementResponse } from '../types/common.js'
import { CreateUserRequest } from '../types/user.js'
import { CreateUserCommand } from './commands/index.js'

@Controller('/users')
export class UserController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/create')
  @HttpCode(200)
  async createUser(@Body() payload: CreateUserRequest): Promise<AcknowledgementResponse> {
    const { password } = payload

    if (!password || password.trim() === '') {
      throw new Error('Password must be a non-empty string')
    }

    const command = new CreateUserCommand({ password })
    return this.commandBus.execute(command)
  }
}