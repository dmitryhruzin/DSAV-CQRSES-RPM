import { Controller, HttpCode, Post, Get, Body, Query, Param } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { AcknowledgementResponse, Paginated } from '../types/common.js'
import { CreateCustomerRequest, CustomerMain } from '../types/customer.js'
import { CreateCustomerCommand } from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/common.js'
import { ListCustomersMainQuery, GetCustomerMainByIdQuery } from './queries/index.js'

@Controller('/customers')
export class CustomerController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/')
  @HttpCode(200)
  async create(@Body() payload: CreateCustomerRequest): Promise<AcknowledgementResponse> {
    const { userID, firstName, lastName, email, phoneNumber } = payload

    if (!userID || userID.trim() === '') {
      throw new Error('User ID must be a non-empty string')
    }
    if (!firstName || firstName.trim() === '') {
      throw new Error('First name must be a non-empty string')
    }
    if (!lastName || lastName.trim() === '') {
      throw new Error('Last name must be a non-empty string')
    }

    const command = new CreateCustomerCommand({ userID, firstName, lastName, email, phoneNumber })
    return this.commandBus.execute(command)
  }

  @Get('/')
  async listCustomersMain(
    @Query('page') page: number,
    @Query('pageSize') pageSize: number
  ): Promise<Paginated<CustomerMain>> {
    const validatedPageSize = pageSize && pageSize > 0 ? Math.min(pageSize, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
    return this.queryBus.execute(new ListCustomersMainQuery(page || PAGE_DEFAULT, validatedPageSize))
  }

  @Get('/:id')
  async getCustomerMainById(@Param('id') id: string): Promise<CustomerMain> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetCustomerMainByIdQuery(id))
  }
}
