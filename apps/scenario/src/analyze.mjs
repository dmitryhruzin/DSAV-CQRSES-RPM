#!/usr/bin/env node
//
// Parse server telemetry log (JSONL from LOG_FILE) into per-method metrics.
//
// Groups requests by HTTP method:
//   POST     create commands
//   PATCH    update commands
//   DELETE   delete commands
//   GET      queries
//
// For each request, sums durationMs per span name (commands often produce
// multiple db.* spans — they get summed into a single per-request total).
//
// For commands (POST/PATCH/DELETE) computes "eventual_consistency_lag":
// time from response sent to the latest event.handle completion for that req.id.
//
// Output: per-method table with count / avg / median / p95 / min / max for
// every span that appeared, plus pino's responseTime as ground truth.
//
// Usage:
//   node apps/scenario/src/analyze.mjs apps/m-cqrs/app.log
//   node apps/scenario/src/analyze.mjs apps/classical-cqrs/app.log
//   npm run analyze --workspace @DSAV-CQRSES-RPM/scenario -- apps/m-cqrs/app.log
//

import { readFileSync } from 'node:fs'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node analyze.mjs <app.log>')
  process.exit(1)
}

// ─── Parse ──────────────────────────────────────────────────────────────────
const records = []
for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
  if (!line) continue
  try {
    records.push(JSON.parse(line))
  } catch {
    /* skip non-JSON lines */
  }
}

// ─── Group by req.id ────────────────────────────────────────────────────────
const byReq = new Map()
for (const r of records) {
  const reqId = r.req?.id
  if (!reqId) continue
  if (!byReq.has(reqId)) byReq.set(reqId, [])
  byReq.get(reqId).push(r)
}

// ─── Build per-request rollup ───────────────────────────────────────────────
const requests = []
for (const [reqId, recs] of byReq) {
  const httpReq = recs.find((r) => r.span === 'http.request')
  if (!httpReq) continue // only requests we actually intercepted

  const method = httpReq.method ?? recs[0]?.req?.method
  const route = httpReq.route ?? recs[0]?.req?.url
  const status = httpReq.status
  const ok = httpReq.success === true && status >= 200 && status < 400

  // Sum durationMs per span name (a request may contain multiple db.* spans)
  const spans = {}
  for (const r of recs) {
    if (r.telemetry !== true || !r.span) continue
    spans[r.span] = (spans[r.span] ?? 0) + (r.durationMs ?? 0)
  }

  // Eventual consistency lag = max(event.handle end) − http.request end (commands only)
  let ecLag = null
  if (method !== 'GET') {
    const httpEnd = (httpReq.startedAt ?? 0) + (httpReq.durationMs ?? 0)
    const handleEnds = recs
      .filter((r) => r.span === 'event.handle' && typeof r.startedAt === 'number')
      .map((r) => r.startedAt + r.durationMs)
    if (handleEnds.length > 0) ecLag = Math.max(...handleEnds) - httpEnd
  }

  // pino's request-completed (server-side TTFB; ground truth)
  const pino = recs.find((r) => r.msg === 'request completed')
  const responseTime = pino?.responseTime

  requests.push({ reqId, method, route, status, ok, spans, ecLag, responseTime })
}

// ─── Group by method ────────────────────────────────────────────────────────
const byMethod = {}
for (const req of requests) {
  if (!byMethod[req.method]) byMethod[req.method] = []
  byMethod[req.method].push(req)
}

// ─── Stats ──────────────────────────────────────────────────────────────────
const stats = (arr) => {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[(sorted.length - 1) / 2]
  return {
    count: sorted.length,
    avg: sum / sorted.length,
    median,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    min: sorted[0],
    max: sorted[sorted.length - 1]
  }
}

// ─── Aggregate per method ───────────────────────────────────────────────────
// Response-time / span / EC-lag stats are computed only over successful
// requests so failed responses (which often short-circuit early) don't bias
// the latency distribution. Error rate is reported separately.
function aggregate(reqs) {
  const okReqs = reqs.filter((r) => r.ok)
  const result = {}

  // Per-span sums (successful requests only)
  const spanNames = new Set()
  for (const r of okReqs) for (const k of Object.keys(r.spans)) spanNames.add(k)

  for (const span of spanNames) {
    const values = okReqs.map((r) => r.spans[span]).filter((v) => v !== undefined)
    result[span] = stats(values)
  }

  // pino responseTime (successful requests only)
  const respTimes = okReqs.map((r) => r.responseTime).filter((v) => v !== undefined)
  if (respTimes.length > 0) result['(pino) responseTime'] = stats(respTimes)

  // Eventual consistency lag (commands only, successful requests only)
  const ecLags = okReqs.map((r) => r.ecLag).filter((v) => v !== null && v !== undefined)
  if (ecLags.length > 0) result.eventual_consistency_lag = stats(ecLags)

  return result
}

// ─── Pretty print ───────────────────────────────────────────────────────────
const methodLabels = {
  POST: 'POST  (create commands)',
  PATCH: 'PATCH (update commands)',
  DELETE: 'DELETE (delete commands)',
  GET: 'GET   (queries)'
}

// Spans excluded from the output table (not used in downstream calculations)
const excludedSpans = new Set([
  'http.request',
  'eventstore.save',
  'eventstore.load',
  'snapshot.load',
  'snapshot.save',
  'projection.save',
  'projection.update'
])

// Order in which spans appear in the output — synthesizes a request lifecycle
const spanOrder = [
  '(pino) responseTime',
  'command.execute',
  'query.execute',
  'db.eventstore.read',
  'db.eventstore.write',
  'db.snapshot.read',
  'db.snapshot.write',
  'db.projection-snapshot.read',
  'db.projection-snapshot.write',
  'event.publishAll',
  'event.publish',
  'event.handle',
  'db.projection.read',
  'db.projection.write',
  'eventual_consistency_lag'
]

const fmt = (n) => (n === null || n === undefined ? '   -   ' : n.toFixed(2).padStart(7))

const printMethod = (method, reqs) => {
  const total = reqs.length
  const okCount = reqs.filter((r) => r.ok).length
  const failCount = total - okCount
  const errorRate = total > 0 ? (failCount / total) * 100 : 0
  const label = methodLabels[method] ?? method
  console.log(`\n═══ ${label} ─ ${total} total / ${okCount} ok / ${failCount} failed ═══`)
  console.log(`  error rate: ${failCount} / ${total}  (${errorRate.toFixed(2)}%)`)

  const agg = aggregate(reqs)
  for (const s of excludedSpans) delete agg[s]
  const ordered = [
    ...spanOrder.filter((s) => agg[s]),
    ...Object.keys(agg)
      .filter((s) => !spanOrder.includes(s))
      .sort()
  ]
  if (ordered.length === 0) {
    console.log('  (no successful requests)')
    return
  }

  console.log(
    `  ${'span'.padEnd(34)}  ${'count'.padStart(5)}  ${'avg'.padStart(7)}  ${'median'.padStart(7)}  ${'p95'.padStart(7)}  ${'min'.padStart(7)}  ${'max'.padStart(7)}`
  )
  console.log('  ' + '─'.repeat(86))
  for (const span of ordered) {
    const s = agg[span]
    if (!s) continue
    const isEc = span === 'eventual_consistency_lag'
    const prefix = isEc ? '★ ' : '  '
    console.log(
      `${prefix}${span.padEnd(34)}  ${String(s.count).padStart(5)}  ${fmt(s.avg)}  ${fmt(s.median)}  ${fmt(s.p95)}  ${fmt(s.min)}  ${fmt(s.max)}`
    )
  }

  // Routes that contributed
  const routes = new Set(reqs.filter((r) => r.ok).map((r) => r.route))
  if (routes.size > 0) console.log(`  routes: ${[...routes].join(', ')}`)
}

// Header
console.log(`Source: ${filePath}`)
console.log(`Parsed: ${records.length} log lines, ${byReq.size} unique req-ids, ${requests.length} requests with http.request span`)

// Methods in conventional order
const methodOrder = ['POST', 'PATCH', 'DELETE', 'GET']
for (const method of methodOrder) {
  if (byMethod[method]) printMethod(method, byMethod[method])
}
// any other methods (shouldn't happen)
for (const method of Object.keys(byMethod)) {
  if (!methodOrder.includes(method)) printMethod(method, byMethod[method])
}

console.log('\n  All values in milliseconds.  ★ = eventual-consistency contribution.')
