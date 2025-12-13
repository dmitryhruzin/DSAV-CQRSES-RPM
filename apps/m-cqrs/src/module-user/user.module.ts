import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { UserController } from './user.controller.js'
import { UserRepository } from './user.repository.js'
import { UserMainProjection } from './projections/user-main.projection.js'
import { InfraModule } from '../infra/infra.module.js'
import {
  CreateUserCommandHandler,
  ChangeUserPasswordCommandHandler,
  UserEnterSystemCommandHandler,
  UserExitSystemCommandHandler
} from './command-handlers/index.js'
import {
  UserCreatedEventHandler,
  UserPasswordChangedEventHandler,
  UserEnteredSystemEventHandler,
  UserExitedSystemEventHandler
} from './event-handlers/index.js'
import { ListUsersMainQueryHandler, GetUserMainByIdQueryHandler } from './query-handlers/index.js'

export const commandHandlers = [
  CreateUserCommandHandler,
  ChangeUserPasswordCommandHandler,
  UserEnterSystemCommandHandler,
  UserExitSystemCommandHandler
]
export const userEventHandlers = [
  UserCreatedEventHandler,
  UserPasswordChangedEventHandler,
  UserEnteredSystemEventHandler,
  UserExitedSystemEventHandler
]
export const queryHandlers = [ListUsersMainQueryHandler, GetUserMainByIdQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule],
  controllers: [UserController],
  providers: [...commandHandlers, ...queryHandlers, ...userEventHandlers, UserRepository, UserMainProjection],
  exports: [UserRepository]
})
export class UserModule {}
