import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { OrderController } from './order.controller.js'
import {
  CreateOrderCommandHandler,
  ApproveOrderCommandHandler,
  StartOrderCommandHandler
} from './command-handlers/index.js'
import {
  OrderCreatedEventHandler,
  OrderApprovedEventHandler,
  OrderStatusChangedEventHandler
} from './event-handlers/index.js'
// import {  } from './query-handlers/index.js'
import { OrderRepository } from './order.repository.js'
import { OrderMainProjection } from './projections/order-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'

export const commandHandlers = [CreateOrderCommandHandler, ApproveOrderCommandHandler, StartOrderCommandHandler]
export const eventHandlers = [OrderCreatedEventHandler, OrderApprovedEventHandler, OrderStatusChangedEventHandler]
export const queryHandlers = []

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule],
  controllers: [OrderController],
  providers: [...commandHandlers, ...queryHandlers, ...eventHandlers, OrderRepository, OrderMainProjection]
})
export class OrderModule {}
