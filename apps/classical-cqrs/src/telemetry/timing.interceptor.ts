import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Request, Response } from 'express'
import { Observable, tap } from 'rxjs'
import { TelemetryService } from './telemetry.service.js'

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()
    const start = this.telemetry.now()
    const startedAt = Date.now()
    const route = (req.route?.path as string | undefined) ?? req.path
    const kind = req.method === 'GET' ? 'query' : 'command'

    const finish = (success: boolean, error?: string) => {
      this.telemetry.mark('http.request', this.telemetry.toMs(start), {
        method: req.method,
        route,
        kind,
        status: res.statusCode,
        startedAt,
        success,
        ...(error ? { error } : {})
      })
    }

    return next.handle().pipe(
      tap({
        next: () => finish(true),
        error: (e: Error) => finish(false, e.message)
      })
    )
  }
}
