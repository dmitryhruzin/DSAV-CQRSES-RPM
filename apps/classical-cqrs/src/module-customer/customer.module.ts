import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { CustomerController } from './customer.controller.js'
import {
  CreateCustomerCommandHandler,
  RenameCustomerCommandHandler,
  ChangeCustomerContactsCommandHandler,
  DeleteCustomerCommandHandler
} from './command-handlers/index.js'
import {
  CustomerCreatedEventHandler,
  CustomerRenamedEventHandler,
  CustomerContactsChangedEventHandler,
  CustomerDeletedEventHandler,
  CarCreatedEventHandler,
  CarOwnerChangedEventHandler,
  CarMileageRecordedEventHandler,
  CarDeletedEventHandler
} from './event-handlers/index.js'
import {
  ListCustomersMainQueryHandler,
  GetCustomerMainByIdQueryHandler,
  GetCustomerWithCarsByIdQueryHandler
} from './query-handlers/index.js'
import { CustomerRepository } from './customer.repository.js'
import { CustomerMainProjection, CustomerWithCarsProjection } from './projections/index.js'
import { InfraModule } from '../infra/infra.module.js'
import { UserModule } from '../module-user/user.module.js'

export const commandHandlers = [
  CreateCustomerCommandHandler,
  RenameCustomerCommandHandler,
  ChangeCustomerContactsCommandHandler,
  DeleteCustomerCommandHandler
]
export const eventHandlers = [
  CustomerCreatedEventHandler,
  CustomerRenamedEventHandler,
  CustomerContactsChangedEventHandler,
  CustomerDeletedEventHandler,
  CarCreatedEventHandler,
  CarOwnerChangedEventHandler,
  CarMileageRecordedEventHandler,
  CarDeletedEventHandler
]
export const queryHandlers = [
  ListCustomersMainQueryHandler,
  GetCustomerMainByIdQueryHandler,
  GetCustomerWithCarsByIdQueryHandler
]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule, UserModule],
  controllers: [CustomerController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    CustomerRepository,
    CustomerMainProjection,
    CustomerWithCarsProjection
  ],
  exports: [CustomerRepository]
})
export class CustomerModule {}
