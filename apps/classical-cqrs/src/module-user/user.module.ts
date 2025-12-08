import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { CqrsModule } from "@nestjs/cqrs"
import { LoggerModule } from "@DSAV-CQRSES-RPM/logger"
import { UserController } from "./user.controller.js"
import { CreateUserCommandHandler, ChangeUserPasswordCommandHandler, UserEnterSystemCommandHandler } from "./command-handlers/index.js"
import { UserCreatedEventHandler, UserPasswordChangedEventHandler, UserEnteredSystemEventHandler } from "./event-handlers/index.js"
import { UserRepository } from "./user.repository.js";
import { UserMainProjection } from "./projections/user-main.projection.js";
import { InfraModule } from "../infra/infra.module.js";

export const commandHandlers = [CreateUserCommandHandler, ChangeUserPasswordCommandHandler, UserEnterSystemCommandHandler]
export const queryHandlers = []
export const userEventHandlers = [UserCreatedEventHandler, UserPasswordChangedEventHandler, UserEnteredSystemEventHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, InfraModule],
  controllers: [UserController],
  providers: [...commandHandlers, ...queryHandlers, ...userEventHandlers, UserRepository, UserMainProjection]
})
export class UserModule {}
