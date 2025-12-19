import { Controller, HttpCode, Get, Post, Patch, Body, Param, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { Paginated, AcknowledgementResponse } from '../types/common.js'
import { ApproveOrderRequest, CreateOrderRequest, OrderMain, StartOrderCommandPayload } from '../types/order.js'
import { CreateOrderCommand, ApproveOrderCommand, StartOrderCommand } from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/common.js'
import { ListOrdersMainQuery, GetOrderMainByIdQuery } from './queries/index.js'

@Controller('/orders')
export class OrderController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/')
  @HttpCode(200)
  async create(@Body() payload: CreateOrderRequest): Promise<AcknowledgementResponse> {
    const { title, price, discount, priority } = payload

    if (!title || title.trim() === '') {
      throw new Error('Title must be a non-empty string')
    }
    if (!price || price.trim() === '') {
      throw new Error('Price must be a non-empty string')
    }

    const command = new CreateOrderCommand({ title, price, discount, priority })
    return this.commandBus.execute(command)
  }

  @Patch('/approve')
  @HttpCode(200)
  async approve(@Body() payload: ApproveOrderRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new ApproveOrderCommand({ id })
    return this.commandBus.execute(command)
  }

  @Patch('/start')
  @HttpCode(200)
  async start(@Body() payload: StartOrderCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const command = new StartOrderCommand({ id })
    return this.commandBus.execute(command)
  }

  @Get('/')
  async listOrdersMain(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number
  ): Promise<Paginated<OrderMain>> {
    const validatedPageSize = pageSize && pageSize > 0 ? Math.min(pageSize, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
    return this.queryBus.execute(new ListOrdersMainQuery(page || PAGE_DEFAULT, validatedPageSize))
  }

  @Get('/:id')
  async getOrderMainById(@Param('id') id: string): Promise<OrderMain> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetOrderMainByIdQuery(id))
  }
}
