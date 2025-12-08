import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { CqrsModule } from "@nestjs/cqrs"
import { LoggerModule } from "@DSAV-CQRSES-RPM/logger"
import { UserController } from "./user.controller.js"
import { CreateUserCommandHandler, ChangeUserPasswordCommandHandler, UserEnterSystemCommandHandler, UserExitSystemCommandHandler } from "./command-handlers/index.js"
import { UserCreatedEventHandler, UserPasswordChangedEventHandler, UserEnteredSystemEventHandler, UserExitedSystemEventHandler } from "./event-handlers/index.js"
import { ListUserMainQueryHandler, GetUserMainByIdQueryHandler } from "./query-handlers/index.js"
import { UserRepository } from "./user.repository.js";
import { UserMainProjection } from "./projections/user-main.projection.js";
import { InfraModule } from "../infra/infra.module.js";

export const commandHandlers = [CreateUserCommandHandler, ChangeUserPasswordCommandHandler, UserEnterSystemCommandHandler, UserExitSystemCommandHandler]
export const userEventHandlers = [UserCreatedEventHandler, UserPasswordChangedEventHandler, UserEnteredSystemEventHandler, UserExitedSystemEventHandler]
export const queryHandlers = [ListUserMainQueryHandler, GetUserMainByIdQueryHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule],
  controllers: [UserController],
  providers: [...commandHandlers, ...queryHandlers, ...userEventHandlers, UserRepository, UserMainProjection]
})
export class UserModule {}
