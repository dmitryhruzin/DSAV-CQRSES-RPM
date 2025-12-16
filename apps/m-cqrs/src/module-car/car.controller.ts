import { Controller, HttpCode, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { Paginated, AcknowledgementResponse } from '../types/common.js'
import { CreateCarRequest, RecordCarMileageRequest, ChangeCarOwnerRequest, CarMain } from '../types/car.js'
import { CreateCarCommand, RecordCarMileageCommand, ChangeCarOwnerCommand, DeleteCarCommand } from './commands/index.js'
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants/common.js'
import { ListCarsMainQuery, GetCarMainByIdQuery } from './queries/index.js'

@Controller('/cars')
export class CarController {
  constructor(
    private commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post('/')
  @HttpCode(200)
  async create(@Body() payload: CreateCarRequest): Promise<AcknowledgementResponse> {
    const { ownerID, vin, registrationNumber, mileage } = payload

    if (!ownerID || ownerID.trim() === '') {
      throw new Error('Owner ID must be a non-empty string')
    }
    if (!vin || vin.trim() === '') {
      throw new Error('VIN must be a non-empty string')
    }
    if (!registrationNumber || registrationNumber.trim() === '') {
      throw new Error('Registration number must be a non-empty string')
    }
    if (mileage === undefined || mileage === null || Number.isNaN(mileage)) {
      throw new Error('Mileage must be a number')
    }

    const command = new CreateCarCommand({ ownerID, vin, registrationNumber, mileage })
    return this.commandBus.execute(command)
  }

  @Patch('/record-mileage')
  @HttpCode(200)
  async recordMileage(@Body() payload: RecordCarMileageRequest): Promise<AcknowledgementResponse> {
    const { id, mileage } = payload

    if (!id || id.trim() === '') {
      throw new Error('Car ID must be a non-empty string')
    }
    if (mileage === undefined || mileage === null || Number.isNaN(mileage)) {
      throw new Error('Mileage must be a number')
    }

    const command = new RecordCarMileageCommand({ id, mileage })
    return this.commandBus.execute(command)
  }

  @Patch('/change-owner')
  @HttpCode(200)
  async changeOwner(@Body() payload: ChangeCarOwnerRequest): Promise<AcknowledgementResponse> {
    const { id, ownerID } = payload

    if (!id || id.trim() === '') {
      throw new Error('Car ID must be a non-empty string')
    }
    if (!ownerID || ownerID.trim() === '') {
      throw new Error('Owner ID must be a non-empty string')
    }

    const command = new ChangeCarOwnerCommand({ id, ownerID })
    return this.commandBus.execute(command)
  }

  @Delete('/:id')
  @HttpCode(200)
  async delete(@Param('id') id: string): Promise<AcknowledgementResponse> {
    if (!id || id.trim() === '') {
      throw new Error('Car ID must be a non-empty string')
    }

    const command = new DeleteCarCommand({ id })
    return this.commandBus.execute(command)
  }

  @Get('/')
  async listCarsMain(@Query('page') page: number, @Query('pageSize') pageSize: number): Promise<Paginated<CarMain>> {
    const validatedPageSize = pageSize && pageSize > 0 ? Math.min(pageSize, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
    return this.queryBus.execute(new ListCarsMainQuery(page || PAGE_DEFAULT, validatedPageSize))
  }

  @Get('/:id')
  async getCarMainById(@Param('id') id: string): Promise<CarMain> {
    if (!id || id.trim() === '') {
      throw new Error('ID must be a non-empty string')
    }

    return this.queryBus.execute(new GetCarMainByIdQuery(id))
  }
}
