import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { KnexModule } from 'nest-knexjs'
import config from '../knexfile.js'
import { UserModule } from './module-user/user.module.js'
import { InfraModule } from './infra/infra.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    InfraModule,
    UserModule,
    KnexModule.forRootAsync({ useFactory: () => ({ config }) })
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    console.log(consumer)
  }
}
