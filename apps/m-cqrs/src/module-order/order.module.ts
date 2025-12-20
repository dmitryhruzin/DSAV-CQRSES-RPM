import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { OrderController } from './order.controller.js'
import {
  CreateOrderCommandHandler,
  ApproveOrderCommandHandler,
  StartOrderCommandHandler,
  CompleteOrderCommandHandler,
  CancelOrderCommandHandler,
  ChangeOrderPriceCommandHandler,
  ApplyDiscountToOrderCommandHandler,
  SetOrderPriorityCommandHandler
} from './command-handlers/index.js'
import {
  OrderCreatedEventHandler,
  OrderApprovedEventHandler,
  OrderStatusChangedEventHandler,
  OrderPriceChangedEventHandler,
  OrderDiscountAppliedEventHandler,
  OrderPrioritySetEventHandler
} from './event-handlers/index.js'
import { ListOrdersMainQueryHandler, GetOrderMainByIdQueryHandler } from './query-handlers/index.js'
import { OrderRepository } from './order.repository.js'
import { OrderMainProjection } from './projections/order-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'

export const commandHandlers = [
  CreateOrderCommandHandler,
  ApproveOrderCommandHandler,
  StartOrderCommandHandler,
  CompleteOrderCommandHandler,
  CancelOrderCommandHandler,
  ChangeOrderPriceCommandHandler,
  ApplyDiscountToOrderCommandHandler,
  SetOrderPriorityCommandHandler
]
export const eventHandlers = [
  OrderCreatedEventHandler,
  OrderApprovedEventHandler,
  OrderStatusChangedEventHandler,
  OrderPriceChangedEventHandler,
  OrderDiscountAppliedEventHandler,
  OrderPrioritySetEventHandler
]
export const queryHandlers = [ListOrdersMainQueryHandler, GetOrderMainByIdQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule],
  controllers: [OrderController],
  providers: [...commandHandlers, ...queryHandlers, ...eventHandlers, OrderRepository, OrderMainProjection]
})
export class OrderModule {}
