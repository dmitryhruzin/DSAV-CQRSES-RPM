import { randomUUID } from 'node:crypto'
import { DynamicModule, Global, Module } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { createProvidersForDecorated } from './injectLogger.js'
import { Logger } from './logger.js'

const REQUEST_ID_HEADER = 'x-request-id'

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
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const upstream = req.headers[REQUEST_ID_HEADER]
              const id = (Array.isArray(upstream) ? upstream[0] : upstream) || randomUUID()
              res.setHeader(REQUEST_ID_HEADER, id)
              return id
            },
            serializers: {
              req: (req: { id?: string; method?: string; url?: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url
              }),
              res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode })
            }
          }
        })
      ],
      providers: [...decorated, Logger],
      exports: [...decorated, Logger]
    }
  }
}
