import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { KnexModule } from 'nest-knexjs'
import config from '../knexfile.js'
import { InfraModule } from './infra/infra.module.js'
import { UserModule } from './module-user/user.module.js'
import { CustomerModule } from './module-customer/customer.module.js'
import { CarModule } from './module-car/car.module.js'
import { WorkerModule } from './module-worker/worker.module.js'
import { OrderModule } from './module-order/order.module.js'
import { WorkModule } from './module-work/work.module.js'
import { TelemetryModule } from './telemetry/telemetry.module.js'
import cacheConfig from './config/cache.config.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [cacheConfig] }),
    LoggerModule.forRoot(),
    TelemetryModule,
    InfraModule,
    UserModule,
    CustomerModule,
    CarModule,
    WorkerModule,
    OrderModule,
    WorkModule,
    KnexModule.forRootAsync({ useFactory: () => ({ config }) })
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    console.log(consumer)
  }
}
