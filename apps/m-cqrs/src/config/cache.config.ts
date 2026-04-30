import { registerAs } from '@nestjs/config'

// Cache namespace — registered with ConfigModule.forRoot({ load: [cacheConfig] }).
// Access via ConfigService.get<boolean>('cache.aggregateCacheEnabled').
//
// AGGREGATE_CACHE_ENABLED — toggle the in-memory aggregate-snapshot cache in
// repositories. Default: false (every aggregate load goes through the DB).
export default registerAs('cache', () => ({
  aggregateCacheEnabled: process.env.AGGREGATE_CACHE_ENABLED === 'true'
}))
