import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// Aggregate snapshot in-memory cache toggle.
//
// Reads ConfigService('cache.aggregateCacheEnabled'), which is populated by
// config/cache.config.ts (registerAs) loaded via ConfigModule.forRoot({ load }).
//
// Resolved once during NestJS onModuleInit and exposed as a static accessor,
// so call sites (repositories) don't need ConfigService injection.
@Injectable()
export class AggregateCacheConfig implements OnModuleInit {
  private static enabled = false

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    AggregateCacheConfig.enabled = this.config.get<boolean>('cache.aggregateCacheEnabled') ?? false
  }

  static isEnabled(): boolean {
    return AggregateCacheConfig.enabled
  }
}
