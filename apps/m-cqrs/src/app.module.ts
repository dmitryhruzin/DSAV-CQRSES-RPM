import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { KnexModule } from 'nest-knexjs'
import config from '../knexfile.js'
import { InfraModule } from './infra/infra.module.js'
import { UserModule } from './module-user/user.module.js'
import { CustomerModule } from './module-customer/customer.module.js'
import { CarModule } from './module-car/car.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    InfraModule,
    UserModule,
    CustomerModule,
    CarModule,
    KnexModule.forRootAsync({ useFactory: () => ({ config }) })
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    console.log(consumer)
  }
}
