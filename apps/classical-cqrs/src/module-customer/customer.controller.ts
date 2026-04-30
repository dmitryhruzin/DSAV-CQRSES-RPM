import { Controller, HttpCode, Post, Patch, Get, Body, Query, Param, Delete } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { AcknowledgementResponse, Paginated } from '../types/common.js'
import {
  ChangeCustomerContactsRequest,
  CreateCustomerRequest,
  CustomerMain,
  CustomerWithCars,
  RenameCustomerRequest
} from '../types/customer.js'
import {
  CreateCustomerCommand,
  RenameCustomerCommand,
  ChangeCustomerContactsCommand,
  DeleteCustomerCommand
} from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, ackOk } from '../constants/common.js'
import { ListCustomersMainQuery, GetCustomerMainByIdQuery, GetCustomerWithCarsByIdQuery } from './queries/index.js'

const AGGREGATE_TYPE = 'Customer'

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

    const id = await this.commandBus.execute<CreateCustomerCommand, string>(
      new CreateCustomerCommand({ userID, firstName, lastName, email, phoneNumber })
    )
    return ackOk(id, AGGREGATE_TYPE)
  }

  @Patch('/rename')
  @HttpCode(200)
  async rename(@Body() payload: RenameCustomerRequest): Promise<AcknowledgementResponse> {
    const { id, firstName, lastName } = payload

    if (!id || id.trim() === '') {
      throw new Error('Customer ID must be a non-empty string')
    }
    if (!firstName || firstName.trim() === '') {
      throw new Error('First name must be a non-empty string')
    }
    if (!lastName || lastName.trim() === '') {
      throw new Error('Last name must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<RenameCustomerCommand, string>(
      new RenameCustomerCommand({ id, firstName, lastName })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Patch('/change-contacts')
  @HttpCode(200)
  async changeContacts(@Body() payload: ChangeCustomerContactsRequest): Promise<AcknowledgementResponse> {
    const { id, email, phoneNumber } = payload

    if (!id || id.trim() === '') {
      throw new Error('Customer ID must be a non-empty string')
    }
    if (!email || email.trim() === '') {
      throw new Error('Email must be a non-empty string')
    }
    if (!phoneNumber || phoneNumber.trim() === '') {
      throw new Error('Phone number must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<ChangeCustomerContactsCommand, string>(
      new ChangeCustomerContactsCommand({ id, email, phoneNumber })
    )
    return ackOk(aggregateId, AGGREGATE_TYPE)
  }

  @Delete('/:id')
  @HttpCode(200)
  async delete(@Param('id') id: string): Promise<AcknowledgementResponse> {
    if (!id || id.trim() === '') {
      throw new Error('Customer ID must be a non-empty string')
    }

    const aggregateId = await this.commandBus.execute<DeleteCustomerCommand, string>(new DeleteCustomerCommand({ id }))
    return ackOk(aggregateId, AGGREGATE_TYPE)
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

  @Get('/:id/with-cars')
  async getCustomerWithCarsById(@Param('id') id: string): Promise<CustomerWithCars> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetCustomerWithCarsByIdQuery(id))
  }
}
