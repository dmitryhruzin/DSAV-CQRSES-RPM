import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { WorkerController } from './worker.controller.js'
import {
  HireWorkerCommandHandler,
  ChangeWorkerRoleCommandHandler,
  ChangeWorkerHourlyRateCommandHandler,
  DismissWorkerCommandHandler
} from './command-handlers/index.js'
import {
  WorkerHiredEventHandler,
  WorkerRoleChangedEventHandler,
  WorkerHourlyRateChangedEventHandler,
  WorkerDismissedEventHandler
} from './event-handlers/index.js'
import { GetWorkerMainByIdQueryHandler, ListWorkersMainQueryHandler } from './query-handlers/index.js'
import { WorkerRepository } from './worker.repository.js'
import { WorkerMainProjection } from './projections/worker-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'

export const commandHandlers = [
  HireWorkerCommandHandler,
  ChangeWorkerRoleCommandHandler,
  ChangeWorkerHourlyRateCommandHandler,
  DismissWorkerCommandHandler
]
export const eventHandlers = [
  WorkerHiredEventHandler,
  WorkerRoleChangedEventHandler,
  WorkerHourlyRateChangedEventHandler,
  WorkerDismissedEventHandler
]
export const queryHandlers = [GetWorkerMainByIdQueryHandler, ListWorkersMainQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule],
  controllers: [WorkerController],
  providers: [...commandHandlers, ...queryHandlers, ...eventHandlers, WorkerRepository, WorkerMainProjection],
  exports: [WorkerRepository]
})
export class WorkerModule {}
