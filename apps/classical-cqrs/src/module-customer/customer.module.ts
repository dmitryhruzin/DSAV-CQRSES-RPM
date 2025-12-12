import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { CustomerController } from './customer.controller.js'
import { CreateCustomerCommandHandler } from './command-handlers/index.js'
import { CustomerCreatedEventHandler } from './event-handlers/index.js'
import { ListCustomersMainQueryHandler, GetCustomerMainByIdQueryHandler } from './query-handlers/index.js'
import { CustomerRepository } from './customer.repository.js'
import { CustomerMainProjection } from './projections/customer-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'
import { UserModule } from '../module-user/user.module.js'

export const commandHandlers = [CreateCustomerCommandHandler]
export const customerEventHandlers = [CustomerCreatedEventHandler]
export const queryHandlers = [ListCustomersMainQueryHandler, GetCustomerMainByIdQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule, UserModule],
  controllers: [CustomerController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...customerEventHandlers,
    CustomerRepository,
    CustomerMainProjection
  ]
})
export class CustomerModule {}
