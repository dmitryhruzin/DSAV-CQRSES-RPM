import { Global, Module } from '@nestjs/common'
import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { TelemetryService } from './telemetry.service.js'

@Global()
@Module({
  imports: [LoggerModule],
  providers: [TelemetryService],
  exports: [TelemetryService]
})
export class TelemetryModule {}
