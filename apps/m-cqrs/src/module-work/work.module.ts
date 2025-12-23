import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { WorkController } from './work.controller.js'
import {
  CreateWorkCommandHandler,
  ChangeWorkTitleCommandHandler,
  ChangeWorkDescriptionCommandHandler,
  SetWorkEstimateCommandHandler,
  StartWorkCommandHandler,
  PauseWorkCommandHandler,
  ResumeWorkCommandHandler,
  CompleteWorkCommandHandler,
  CancelWorkCommandHandler,
  AssignWorkToWorkerCommandHandler,
  UnassignWorkFromWorkerCommandHandler,
  AddWorkToOrderCommandHandler,
  RemoveWorkFromOrderCommandHandler
} from './command-handlers/index.js'
import {
  WorkCreatedEventHandler,
  WorkTitleChangedEventHandler,
  WorkDescriptionChangedEventHandler,
  WorkEstimateSetEventHandler,
  WorkStatusChangedEventHandler,
  WorkAssignedToWorkerEventHandler,
  WorkUnassignedFromWorkerEventHandler,
  WorkAddedToOrderEventHandler,
  WorkRemovedFromOrderEventHandler
} from './event-handlers/index.js'
import { ListWorkMainQueryHandler, GetWorkMainByIdQueryHandler } from './query-handlers/index.js'
import { WorkRepository } from './work.repository.js'
import { WorkMainProjection } from './projections/work-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'
import { WorkerModule } from '../module-worker/worker.module.js'
import { OrderModule } from '../module-order/order.module.js'

export const commandHandlers = [
  CreateWorkCommandHandler,
  ChangeWorkTitleCommandHandler,
  ChangeWorkDescriptionCommandHandler,
  SetWorkEstimateCommandHandler,
  StartWorkCommandHandler,
  PauseWorkCommandHandler,
  ResumeWorkCommandHandler,
  CompleteWorkCommandHandler,
  CancelWorkCommandHandler,
  AssignWorkToWorkerCommandHandler,
  UnassignWorkFromWorkerCommandHandler,
  AddWorkToOrderCommandHandler,
  RemoveWorkFromOrderCommandHandler
]
export const eventHandlers = [
  WorkCreatedEventHandler,
  WorkTitleChangedEventHandler,
  WorkDescriptionChangedEventHandler,
  WorkEstimateSetEventHandler,
  WorkStatusChangedEventHandler,
  WorkAssignedToWorkerEventHandler,
  WorkUnassignedFromWorkerEventHandler,
  WorkAddedToOrderEventHandler,
  WorkRemovedFromOrderEventHandler
]

export const queryHandlers = [ListWorkMainQueryHandler, GetWorkMainByIdQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule, WorkerModule, OrderModule],
  controllers: [WorkController],
  providers: [...commandHandlers, ...queryHandlers, ...eventHandlers, WorkRepository, WorkMainProjection]
})
export class WorkModule {}
