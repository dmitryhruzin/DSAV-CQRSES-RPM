import { Injectable } from '@nestjs/common'
import { InjectLogger, Logger } from '@DSAV-CQRSES-RPM/logger'

export type TelemetryAttrs = Record<string, unknown>

@Injectable()
export class TelemetryService {
  constructor(@InjectLogger(TelemetryService.name) private readonly logger: Logger) {}

  now(): bigint {
    return process.hrtime.bigint()
  }

  toMs(start: bigint, end: bigint = process.hrtime.bigint()): number {
    return Number(end - start) / 1_000_000
  }

  mark(span: string, durationMs: number, attrs: TelemetryAttrs = {}): void {
    this.logger.info({ telemetry: true, span, durationMs, ...attrs })
  }

  async time<T>(span: string, fn: () => Promise<T> | T, attrs: TelemetryAttrs = {}): Promise<T> {
    const start = this.now()
    const startedAt = Date.now()
    try {
      const result = await fn()
      this.mark(span, this.toMs(start), { ...attrs, success: true, startedAt })
      return result
    } catch (e) {
      this.mark(span, this.toMs(start), { ...attrs, success: false, startedAt, error: (e as Error).message })
      throw e
    }
  }
}
