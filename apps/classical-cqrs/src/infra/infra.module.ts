import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AggregateSnapshotRepository } from './aggregate-snapshot.repository.js'
import { EventStoreRepository } from './event-store.repository.js'
import { Aggregate } from './aggregate.js'

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [AggregateSnapshotRepository, Aggregate, EventStoreRepository],
  exports: [AggregateSnapshotRepository, Aggregate, EventStoreRepository]
})
export class InfraModule {}
