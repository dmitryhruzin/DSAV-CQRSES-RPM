import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { CqrsModule } from "@nestjs/cqrs"
import { LoggerModule } from "@DSAV-CQRSES-RPM/logger"
import { UserController } from "./user.controller.js"
import { CreateUserCommandHandler } from "./command-handlers/index.js"
import { UserCreatedEventHandler } from "./event-handlers/index.js"
import { UserRepository } from "./user.repository.js";
import { UserMainProjection } from "./projections/user-main.projection.js";
import { EventStoreModule } from "../infra/event-store-module/event-store.module.js";
import { AggregateModule } from "../infra/aggregate-module/aggregate.module.js";

export const commandHandlers = [CreateUserCommandHandler]
export const queryHandlers = []
export const userEventHandlers = [UserCreatedEventHandler]

@Module({
  imports: [ConfigModule, LoggerModule, CqrsModule, EventStoreModule, AggregateModule],
  controllers: [UserController],
  providers: [...commandHandlers, ...queryHandlers, ...userEventHandlers, UserRepository, UserMainProjection]
})
export class UserModule {}
