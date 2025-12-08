import { LoggerErrorInterceptor } from '@DSAV-CQRSES-RPM/logger'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { Request, Response } from 'express'
import { AppModule } from './app.module.js'

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true
  })

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  app.useGlobalInterceptors(new LoggerErrorInterceptor())

  await app.listen(process.env.PORT || 8000)
}
await bootstrap()
