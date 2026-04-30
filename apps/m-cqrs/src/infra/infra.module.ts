import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventStoreRepository } from './event-store.repository.js'
import { Aggregate } from './aggregate.js'
import { AggregateCacheConfig } from './aggregate-cache.config.js'

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [Aggregate, EventStoreRepository, AggregateCacheConfig],
  exports: [Aggregate, EventStoreRepository, AggregateCacheConfig]
})
export class InfraModule {}
