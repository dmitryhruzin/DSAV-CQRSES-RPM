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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    InfraModule,
    UserModule,
    CustomerModule,
    CarModule,
    WorkerModule,
    OrderModule,
    KnexModule.forRootAsync({ useFactory: () => ({ config }) })
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    console.log(consumer)
  }
}
