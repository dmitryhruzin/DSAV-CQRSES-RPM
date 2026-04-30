import knex from 'knex'
import { TelemetryService } from './telemetry.service.js'

interface KnexQueryEvent {
  __knexQueryUid?: string
  sql: string
  bindings?: unknown[]
  method?: string
}

interface KnexQueryResponseError extends KnexQueryEvent {
  message?: string
}

type DbKind = 'eventstore' | 'snapshot' | 'projection-snapshot' | 'projection' | 'other'
type DbVerb = 'read' | 'write' | 'other'

const previewSql = (sql: string): string => (sql.length > 200 ? `${sql.slice(0, 200)}...` : sql)

const tableFromSql = (sql: string): string | undefined => {
  const m = sql.match(/(?:from|into|update|join|table)\s+["`']?([\w-]+)["`']?/i)
  return m?.[1]
}

const verbFromSql = (sql: string): DbVerb => {
  const word = sql.trim().split(/\s+/, 1)[0]?.toLowerCase()
  if (word === 'select') return 'read'
  if (word === 'insert' || word === 'update' || word === 'delete') return 'write'
  return 'other'
}

const kindFromTable = (table: string | undefined): DbKind => {
  if (!table) return 'other'
  if (table === 'events') return 'eventstore'
  if (table === 'snapshots' || table.startsWith('aggregate-')) return 'snapshot'
  if (table.endsWith('-snapshot')) return 'projection-snapshot'
  return 'projection'
}

const spanName = (kind: DbKind, verb: DbVerb): string => `db.${kind}.${verb}`

export const installKnexTelemetry = (connection: knex.Knex, telemetry: TelemetryService): void => {
  const startTimes = new Map<string, { hr: bigint; wall: number }>()

  connection.on('query', (q: KnexQueryEvent) => {
    if (q.__knexQueryUid) startTimes.set(q.__knexQueryUid, { hr: telemetry.now(), wall: Date.now() })
  })

  const finish = (q: KnexQueryEvent, success: boolean, error?: string) => {
    if (!q.__knexQueryUid) return
    const start = startTimes.get(q.__knexQueryUid)
    if (!start) return
    startTimes.delete(q.__knexQueryUid)

    const table = tableFromSql(q.sql)
    const kind = kindFromTable(table)
    const verb = verbFromSql(q.sql)

    telemetry.mark(spanName(kind, verb), telemetry.toMs(start.hr), {
      kind,
      verb,
      method: q.method,
      table,
      sql: previewSql(q.sql),
      startedAt: start.wall,
      success,
      ...(error ? { error } : {})
    })
  }

  connection.on('query-response', (_response: unknown, q: KnexQueryEvent) => finish(q, true))
  connection.on('query-error', (error: KnexQueryResponseError, q: KnexQueryEvent) => finish(q, false, error?.message))
}
