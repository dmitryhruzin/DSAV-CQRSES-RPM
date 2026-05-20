#!/usr/bin/env node
// Compute per-metric distribution stats for *-seq logs in ./logs10/, grouped by req.id.
// Writes log-analisis.md with one block per log file × method × metric.
//
// Stats per metric: count, mean, median, p90, p95, variance (σ², population), stdev (σ),
// CV² = σ² / mean². All durations in milliseconds.
//
// Missing spans contribute 0 to any sum (per user spec).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, 'logs10-noretry')
const OUT = join(HERE, 'log-analisis-seq.md')

const LOG_FILES = [
  'm7i-gp3-m_cqrs-seq.log',
  'm7i-io2-m_cqrs-seq.log',
  'm7a-gp3-m_cqrs-seq.log',
  'm7a-io2-m_cqrs-seq.log',
]

// Per-method metric definitions (order preserved in output).
// Each metric returns a numeric value given a parsed request object.
function buildMetrics() {
  const sumSpan = (req, name) =>
    (req.spans[name] || []).reduce((s, [, d]) => s + d, 0)

  const httpDur = (req) => req.httpDur

  // Time from http.request startedAt → end of the LAST event.handle for the same req.
  const handlerEnd = (req) => {
    const hs = req.spans['event.handle'] || []
    if (hs.length === 0 || req.httpStart == null) return null
    const end = Math.max(...hs.map(([st, d]) => st + d))
    return end - req.httpStart
  }

  const GET = {
    responseTime: (r) => httpDur(r),
    'query.execute − db.projection.read': (r) =>
      sumSpan(r, 'query.execute') - sumSpan(r, 'db.projection.read'),
    'db.projection.read': (r) => sumSpan(r, 'db.projection.read'),
  }

  const cmdBase = {
    responseTime: (r) => httpDur(r),
    'req_start → last event.handle end': (r) => handlerEnd(r),
    'command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write':
      (r) =>
        sumSpan(r, 'command.execute') +
        sumSpan(r, 'event.publishAll') -
        sumSpan(r, 'db.eventstore.write') -
        sumSpan(r, 'db.snapshot.read') -
        sumSpan(r, 'db.snapshot.write'),
    'db.eventstore.write': (r) => sumSpan(r, 'db.eventstore.write'),
    'db.snapshot.read + db.snapshot.write': (r) =>
      sumSpan(r, 'db.snapshot.read') + sumSpan(r, 'db.snapshot.write'),
  }

  const POST = {
    ...cmdBase,
    'event.handle − db.projection.write': (r) =>
      sumSpan(r, 'event.handle') - sumSpan(r, 'db.projection.write'),
    'db.projection.write': (r) => sumSpan(r, 'db.projection.write'),
  }

  const PATCH = {
    ...cmdBase,
    'event.handle − db.projection.read − db.projection.write': (r) =>
      sumSpan(r, 'event.handle') -
      sumSpan(r, 'db.projection.read') -
      sumSpan(r, 'db.projection.write'),
    'db.projection.read': (r) => sumSpan(r, 'db.projection.read'),
    'db.projection.write': (r) => sumSpan(r, 'db.projection.write'),
  }

  return { GET, POST, PATCH }
}

function parse(path) {
  const byReq = new Map()
  const text = readFileSync(path, 'utf-8')
  for (const ln of text.split('\n')) {
    if (!ln) continue
    let e
    try { e = JSON.parse(ln) } catch { continue }
    const sp = e.span
    if (!sp) continue
    const req = e.req || {}
    const rid = req.id
    if (!rid) continue
    const d = e.durationMs
    const st = e.startedAt
    let r = byReq.get(rid)
    if (!r) {
      r = { method: null, httpStart: null, httpDur: null, spans: Object.create(null) }
      byReq.set(rid, r)
    }
    if (!r.method) r.method = req.method
    if (sp === 'http.request') {
      r.httpStart = st ?? r.httpStart
      r.httpDur = d ?? r.httpDur
    }
    if (typeof d === 'number' && typeof st === 'number') {
      ;(r.spans[sp] || (r.spans[sp] = [])).push([st, d])
    }
  }
  return byReq
}

function stats(vals) {
  const n = vals.length
  if (n === 0) return null
  const s = [...vals].sort((a, b) => a - b)
  const sum = vals.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2
  const pick = (p) => s[Math.min(n - 1, Math.floor(p * (n - 1) + 0.5))]
  const p90 = pick(0.9)
  const p95 = pick(0.95)
  const variance = vals.reduce((a, x) => a + (x - mean) ** 2, 0) / n
  const stdev = Math.sqrt(variance)
  const cv2 = mean !== 0 ? variance / (mean * mean) : 0
  return { count: n, mean, median, p90, p95, variance, stdev, cv2 }
}

function fmt(x, digits = 4) {
  if (x === null || x === undefined) return '–'
  if (Number.isNaN(x)) return 'NaN'
  return x.toFixed(digits)
}

function renderTable(method, metrics, samples) {
  const COLS = ['count', 'mean', 'median', 'p90', 'p95', 'variance', 'stdev', 'CV²']
  // Build raw cells per row first to measure widths.
  const rows = []
  for (const name of Object.keys(metrics)) {
    const vals = samples[name] || []
    const st = stats(vals)
    if (!st) {
      rows.push({ name, cells: ['0', '–', '–', '–', '–', '–', '–', '–'] })
    } else {
      rows.push({
        name,
        cells: [
          String(st.count),
          fmt(st.mean, 4),
          fmt(st.median, 4),
          fmt(st.p90, 4),
          fmt(st.p95, 4),
          fmt(st.variance, 4),
          fmt(st.stdev, 4),
          fmt(st.cv2, 4),
        ],
      })
    }
  }
  // Column widths.
  const metricW = Math.max('metric'.length, ...rows.map((r) => r.name.length))
  const widths = COLS.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r.cells[i].length))
  )

  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length))
  const padL = (s, w) => ' '.repeat(Math.max(0, w - s.length)) + s

  const lines = []
  // Header
  lines.push(
    '| ' + pad('metric', metricW) + ' | ' +
    COLS.map((h, i) => padL(h, widths[i])).join(' | ') + ' |'
  )
  // Separator — alignment markers + dashes to column width
  lines.push(
    '|:' + '-'.repeat(metricW + 1) + '|' +
    widths.map((w) => '-'.repeat(w + 1) + ':|').join('')
  )
  // Rows
  for (const r of rows) {
    lines.push(
      '| ' + pad(r.name, metricW) + ' | ' +
      r.cells.map((c, i) => padL(c, widths[i])).join(' | ') + ' |'
    )
  }
  return lines.join('\n')
}

function main() {
  const metrics = buildMetrics()

  const out = []
  out.push('# Метрики *-seq логов (после 10s skip + retry-strip)')
  out.push('')
  out.push('Источник: [apps/JMT-prediction-manual/logs10-noretry/](logs10-noretry/).')
  out.push('')
  out.push('Группировка — по `req.id`. Для каждой группы суммируются длительности всех спанов с заданным именем; отсутствующий спан = 0 мс.')
  out.push('')
  out.push('В отличие от сырых `logs10/`, здесь `event.handle.durationMs` нормализован: для каждого спана с признаком retry (`originalDurationMs > 950ms`) вычтено `N × 1000ms`, где `N` — количество ретраев VersionMismatch-логики ([_strip_retries.mjs](_strip_retries.mjs)). Это убирает синтетические 1-секундные `setTimeout`-паузы и оставляет «полезное» время хендлера.')
  out.push('')
  out.push('Поля метрик:')
  out.push('')
  out.push('- **responseTime** — `http.request.durationMs` из telemetry-спана (не pino `responseTime`).')
  out.push('- **req_start → last event.handle end** — `max(event.handle.startedAt + durationMs) − http.request.startedAt`. Считается только по запросам, у которых есть хотя бы один `event.handle`.')
  out.push('- Все остальные строки = алгебра сумм длительностей спанов: `sum(A) + sum(B) − …`. Отсутствующий спан = 0.')
  out.push('')
  out.push('Статистики (population): count, mean, median, p90, p95, variance σ², stdev σ, CV² = σ²/mean². Все длительности в **миллисекундах**.')
  out.push('')

  for (const fname of LOG_FILES) {
    process.stderr.write(`Processing ${fname}...\n`)
    const byReq = parse(join(LOGS, fname))

    const samples = { GET: {}, POST: {}, PATCH: {} }
    for (const m of Object.keys(metrics)) {
      for (const name of Object.keys(metrics[m])) samples[m][name] = []
    }

    let counts = { GET: 0, POST: 0, PATCH: 0 }
    for (const r of byReq.values()) {
      const m = r.method
      if (!(m in metrics)) continue
      if (r.httpDur == null) continue
      counts[m]++
      for (const [name, fn] of Object.entries(metrics[m])) {
        const v = fn(r)
        if (v !== null && v !== undefined && !Number.isNaN(v)) samples[m][name].push(v)
      }
    }

    out.push(`## ${fname}`)
    out.push('')
    for (const m of ['GET', 'POST', 'PATCH']) {
      out.push(`### ${m} — ${counts[m]} requests`)
      out.push('')
      out.push(renderTable(m, metrics[m], samples[m]))
      out.push('')
    }
  }

  writeFileSync(OUT, out.join('\n'))
  process.stderr.write(`Wrote ${OUT}\n`)
}

main()
