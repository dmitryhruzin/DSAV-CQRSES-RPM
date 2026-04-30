import { LoggerErrorInterceptor } from '@DSAV-CQRSES-RPM/logger'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs'
import { Request, Response } from 'express'
import type knex from 'knex'
import { getConnectionToken } from 'nest-knexjs'
import { AppModule } from './app.module.js'
import {
  TelemetryService,
  TimingInterceptor,
  installCqrsTelemetry,
  installEventHandlerTelemetry,
  installKnexTelemetry
} from './telemetry/index.js'

@Catch(HttpException)
class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const body = {
      statusCode: exception.getStatus(),
      timestamp: new Date().toISOString(),
      path: request.url,
      response: exception.getResponse()
    }

    response.status(exception.getStatus()).json(body)
  }
}

@Catch(Error)
class ErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const body = {
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url,
      response: exception.message
    }

    response.status(500).json(body)
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true
  })

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalFilters(new ErrorFilter())
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  app.useGlobalInterceptors(new LoggerErrorInterceptor())

  const telemetry = app.get(TelemetryService)
  app.useGlobalInterceptors(new TimingInterceptor(telemetry))

  installCqrsTelemetry(app.get(CommandBus), app.get(QueryBus), app.get(EventBus), telemetry)
  installEventHandlerTelemetry(app, telemetry)
  installKnexTelemetry(app.get<knex.Knex>(getConnectionToken() as string), telemetry)

  await app.listen(process.env.PORT || 8000)
}
await bootstrap()
