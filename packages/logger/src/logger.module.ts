import { randomUUID } from 'node:crypto'
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { DynamicModule, Global, Module } from '@nestjs/common'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { multistream, type StreamEntry } from 'pino'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { createProvidersForDecorated } from './injectLogger.js'
import { Logger } from './logger.js'

const REQUEST_ID_HEADER = 'x-request-id'

const buildDestinationStream = () => {
  const logFile = process.env.LOG_FILE
  if (!logFile) return undefined

  const path = isAbsolute(logFile) ? logFile : resolve(process.cwd(), logFile)
  mkdirSync(dirname(path), { recursive: true })

  const streams: StreamEntry[] = [
    { stream: process.stdout },
    { stream: createWriteStream(path, { flags: 'a' }) }
  ]
  return multistream(streams)
}

@Global()
@Module({ providers: [Logger], exports: [Logger] })
export class LoggerModule {
  static forRoot(): DynamicModule {
    const decorated = createProvidersForDecorated()
    const stream = buildDestinationStream()

    const pinoOptions = {
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

    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: stream ? [pinoOptions, stream] : pinoOptions
        })
      ],
      providers: [...decorated, Logger],
      exports: [...decorated, Logger]
    }
  }
}
