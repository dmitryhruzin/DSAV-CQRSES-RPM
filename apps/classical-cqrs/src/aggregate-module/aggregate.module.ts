import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AggregateSnapshotRepository } from './aggregate-snapshot.repository.js'
import { Aggregate } from './aggregate.js'

/**
 * Module for managing event store related dependencies and providers.
 *
 * @module EventStoreModule
 */
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [AggregateSnapshotRepository, Aggregate],
  exports: [AggregateSnapshotRepository, Aggregate]
})
export class AggregateModule {}
