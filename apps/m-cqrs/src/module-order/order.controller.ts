import { Controller, HttpCode, Get, Post, Patch, Body, Param, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { Paginated, AcknowledgementResponse } from '../types/common.js'
import {
  ApproveOrderRequest,
  CancelOrderCommandPayload,
  CompleteOrderCommandPayload,
  CreateOrderRequest,
  OrderMain,
  StartOrderCommandPayload,
  ChangeOrderPriceCommandPayload,
  ApplyDiscountToOrderCommandPayload,
  SetOrderPriorityCommandPayload
} from '../types/order.js'
import {
  CreateOrderCommand,
  ApproveOrderCommand,
  StartOrderCommand,
  CompleteOrderCommand,
  CancelOrderCommand,
  ChangeOrderPriceCommand,
  ApplyDiscountToOrderCommand,
  SetOrderPriorityCommand
} from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, ackOk } from '../constants/common.js'
import { ListOrdersMainQuery, GetOrderMainByIdQuery } from './queries/index.js'

const AGGREGATE_TYPE = 'Order'

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

    const id = await this.commandBus.execute<CreateOrderCommand, string>(
      new CreateOrderCommand({ title, price, discount, priority })
    )
    return ackOk(id, AGGREGATE_TYPE)
  }

  @Patch('/approve')
  @HttpCode(200)
  async approve(@Body() payload: ApproveOrderRequest): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ApproveOrderCommand, string>(new ApproveOrderCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/start')
  @HttpCode(200)
  async start(@Body() payload: StartOrderCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<StartOrderCommand, string>(new StartOrderCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/complete')
  @HttpCode(200)
  async complete(@Body() payload: CompleteOrderCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<CompleteOrderCommand, string>(new CompleteOrderCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/cancel')
  @HttpCode(200)
  async cancel(@Body() payload: CancelOrderCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<CancelOrderCommand, string>(new CancelOrderCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/change-price')
  @HttpCode(200)
  async changePrice(@Body() payload: ChangeOrderPriceCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!payload.price || payload.price.trim() === '') {
      throw new Error('Price must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ChangeOrderPriceCommand, string>(
      new ChangeOrderPriceCommand({ id, price: payload.price })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/apply-discount')
  @HttpCode(200)
  async applyDiscount(@Body() payload: ApplyDiscountToOrderCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (!payload.discount || payload.discount.trim() === '') {
      throw new Error('Discount must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ApplyDiscountToOrderCommand, string>(
      new ApplyDiscountToOrderCommand({ id, discount: payload.discount })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/set-priority')
  @HttpCode(200)
  async setPriority(@Body() payload: SetOrderPriorityCommandPayload): Promise<AcknowledgementResponse> {
    const { id } = payload

    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }
    if (Number.isNaN(payload.priority) || payload.priority === undefined || payload.priority === null) {
      throw new Error('Priority must be provided')
    }

    const aggregateId = await this.commandBus.execute<SetOrderPriorityCommand, string>(
      new SetOrderPriorityCommand({ id, priority: payload.priority })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
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
