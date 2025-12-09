import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventStoreRepository } from './event-store.repository.js'
import { Aggregate } from './aggregate.js'

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [Aggregate, EventStoreRepository],
  exports: [Aggregate, EventStoreRepository]
})
export class InfraModule {}
