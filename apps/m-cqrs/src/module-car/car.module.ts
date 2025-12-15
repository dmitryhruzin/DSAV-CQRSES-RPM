import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { CarController } from './car.controller.js'
import {
  CreateCarCommandHandler,
  RecordCarMileageCommandHandler,
  ChangeCarOwnerCommandHandler,
  DeleteCarCommandHandler
} from './command-handlers/index.js'
import {
  CarCreatedEventHandler,
  CarMileageRecordedEventHandler,
  CarOwnerChangedEventHandler,
  CarDeletedEventHandler
} from './event-handlers/index.js'
import { ListCarsMainQueryHandler, GetCarMainByIdQueryHandler } from './query-handlers/index.js'
import { CarRepository } from './car.repository.js'
import { CarMainProjection } from './projections/car-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'
import { CustomerModule } from '../module-customer/customer.module.js'

export const commandHandlers = [
  CreateCarCommandHandler,
  RecordCarMileageCommandHandler,
  ChangeCarOwnerCommandHandler,
  DeleteCarCommandHandler
]
export const eventHandlers = [
  CarCreatedEventHandler,
  CarMileageRecordedEventHandler,
  CarOwnerChangedEventHandler,
  CarDeletedEventHandler
]
export const queryHandlers = [ListCarsMainQueryHandler, GetCarMainByIdQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule, CustomerModule],
  controllers: [CarController],
  providers: [...commandHandlers, ...queryHandlers, ...eventHandlers, CarRepository, CarMainProjection]
})
export class CarModule {}
