import { DynamicModule, Global, Module } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { createProvidersForDecorated } from './injectLogger.js'
import { Logger } from './logger.js'

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerModule {
  static forRoot(): DynamicModule {
    const decorated = createProvidersForDecorated()

    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            redact: ['req', 'res']
          }
        })
      ],
      providers: [...decorated, Logger],
      exports: [...decorated, Logger]
    }
  }
}
