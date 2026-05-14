#!/usr/bin/env node
// Generates analyz-10.md — same calculations as analyz.md but ignores the
// first 10 seconds of workload in each log file (filters requests whose
// http.request startedAt falls within the first 10 000 ms after the FIRST
// http.request — i.e., the actual start of the load, not server boot).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOGS_DIR = __dirname
const OUT_FILE = join(LOGS_DIR, 'analyz-10.md')
const SKIP_MS = 10_000

const SECTIONS = [
  { title: 'M7i.large gp3', prefix: 'm7i-gp3' },
  { title: 'M7a.large gp3', prefix: 'm7a-gp3' },
  { title: 'M7g.large gp3', prefix: 'm7g-gp3' },
  { title: 'M7i.large io2', prefix: 'm7i-io2' },
  { title: 'M7a.large io2', prefix: 'm7a-io2' },
  { title: 'M7g.large io2', prefix: 'm7g-io2' }
]
const VARIANTS = [
  { title: 'mCQRS Sequential', suffix: 'm_cqrs-seq' },
  { title: 'mCQRS Load', suffix: 'm_cqrs-load' },
  { title: 'Classical CQRS Sequential', suffix: 'classical_cqrs-seq' },
  { title: 'Classical CQRS Load', suffix: 'classical_cqrs-load' }
]
const METHODS_ORDER = ['POST', 'PATCH', 'GET']
const METHOD_LABEL = {
  POST: 'POST  (create commands)',
  PATCH: 'PATCH (update commands)',
  GET: 'GET   (queries)'
}

// ───── Stats ────────────────────────────────────────────────────────────────
function stats(arr) {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  const avg = sum / n
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
  const pick = (p) => sorted[Math.min(n - 1, Math.floor(n * p))]
  const variance = sorted.reduce((s, x) => s + (x - avg) ** 2, 0) / n
  const stdev = Math.sqrt(variance)
  return {
    count: n,
    avg,
    median,
    p90: pick(0.9),
    p95: pick(0.95),
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    variance,
    stdev
  }
}

// ───── Parse one log file ───────────────────────────────────────────────────
function parseLog(filePath) {
  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n')
  const records = []
  let firstHttpStart = Infinity
  for (const ln of lines) {
    if (!ln) continue
    try {
      const r = JSON.parse(ln)
      records.push(r)
      if (r.span === 'http.request' && typeof r.startedAt === 'number' && r.startedAt < firstHttpStart) {
        firstHttpStart = r.startedAt
      }
    } catch {
      /* skip */
    }
  }

  // Group by req.id
  const byReq = new Map()
  for (const r of records) {
    const id = r.req?.id
    if (!id) continue
    if (!byReq.has(id)) byReq.set(id, [])
    byReq.get(id).push(r)
  }

  // Build per-request rollup, applying 10s skip anchored to the FIRST
  // http.request (start of the actual workload, not server boot)
  const cutoff = firstHttpStart + SKIP_MS
  const requests = []
  let totalRequests = 0
  for (const [reqId, recs] of byReq) {
    const httpReq = recs.find((r) => r.span === 'http.request')
    if (!httpReq) continue
    totalRequests++
    if ((httpReq.startedAt ?? 0) < cutoff) continue

    const method = httpReq.method ?? recs[0]?.req?.method
    const status = httpReq.status
    const ok = httpReq.success === true && status >= 200 && status < 400

    // consistency_lag = max(event.handle end) − http.request startedAt   (commands only)
    let cLag = null
    if (method !== 'GET') {
      const reqStart = httpReq.startedAt ?? 0
      const handleEnds = recs
        .filter((r) => r.span === 'event.handle' && typeof r.startedAt === 'number')
        .map((r) => r.startedAt + (r.durationMs ?? 0))
      if (handleEnds.length > 0) cLag = Math.max(...handleEnds) - reqStart
    }

    requests.push({
      reqId,
      method,
      ok,
      httpDuration: httpReq.durationMs,
      consistencyLag: cLag
    })
  }

  return { records, byReq, requests, totalRequests, firstHttpStart }
}

// ───── Render one log block (text, monospace) ───────────────────────────────
const NUM_COLS = ['count', 'avg', 'median', 'p90', 'p95', 'min', 'max', 'range', 'variance', 'stdev']
const HEAD_LABEL = {
  count: 'count',
  avg: 'avg',
  median: 'median',
  p90: 'p90',
  p95: 'p95',
  min: 'min',
  max: 'max',
  range: 'range',
  variance: 'variance',
  stdev: 'stdev'
}

function fmtNum(v, col) {
  if (v === null || v === undefined) return '-'
  if (col === 'count') return String(v)
  return v.toFixed(2)
}

function renderTable(rows) {
  // rows: [{ label, star, stats }]
  // Determine column widths
  const widths = {}
  for (const c of NUM_COLS) widths[c] = HEAD_LABEL[c].length
  for (const row of rows) {
    if (!row.stats) continue
    for (const c of NUM_COLS) {
      const s = fmtNum(row.stats[c], c)
      if (s.length > widths[c]) widths[c] = s.length
    }
  }
  // metric column width
  let metricW = 'metric'.length
  for (const row of rows) {
    const label = (row.star ? '★ ' : '  ') + row.label
    if (label.length > metricW) metricW = label.length
  }

  const headParts = [
    '  ' + 'metric'.padEnd(metricW),
    ...NUM_COLS.map((c) => HEAD_LABEL[c].padStart(widths[c]))
  ]
  // Spacing: original uses two-space separator between metric and counters.
  // Use two-space gaps consistently.
  const header = headParts.join('  ')
  const rule = '  ' + '─'.repeat(header.length - 2)

  const out = [header, rule]
  for (const row of rows) {
    if (!row.stats) continue
    const label = (row.star ? '★ ' : '  ') + row.label
    const parts = [
      '  ' + label.padEnd(metricW),
      ...NUM_COLS.map((c) => fmtNum(row.stats[c], c).padStart(widths[c]))
    ]
    out.push(parts.join('  '))
  }
  return out.join('\n')
}

function renderLogBlock(sourceLabel, info) {
  const { records, byReq, requests, totalRequests } = info
  const lines = []
  lines.push(`Source: ${sourceLabel}`)
  lines.push(
    `Parsed: ${records.length} log lines, ${byReq.size} unique req-ids, ${totalRequests} requests with http.request span ` +
      `(after 10s skip: ${requests.length} analysed)`
  )

  const byMethod = {}
  for (const r of requests) {
    if (!byMethod[r.method]) byMethod[r.method] = []
    byMethod[r.method].push(r)
  }

  for (const method of METHODS_ORDER) {
    const reqs = byMethod[method] || []
    if (reqs.length === 0) continue
    const okCount = reqs.filter((r) => r.ok).length
    const failCount = reqs.length - okCount
    const errRate = reqs.length > 0 ? (failCount / reqs.length) * 100 : 0
    lines.push('')
    lines.push(`═══ ${METHOD_LABEL[method] ?? method} ─ ${reqs.length} total / ${okCount} ok / ${failCount} failed ═══`)
    lines.push(`  error rate: ${failCount} / ${reqs.length}  (${errRate.toFixed(2)}%)`)

    const okReqs = reqs.filter((r) => r.ok)
    const httpVals = okReqs.map((r) => r.httpDuration).filter((v) => typeof v === 'number')
    const httpStats = stats(httpVals)
    const tableRows = [{ label: 'http.request', star: false, stats: httpStats }]

    if (method !== 'GET') {
      const cVals = okReqs.map((r) => r.consistencyLag).filter((v) => v !== null && v !== undefined)
      const cStats = stats(cVals)
      tableRows.push({ label: 'consistency_lag', star: true, stats: cStats })
    }

    lines.push(renderTable(tableRows))
  }
  return lines.join('\n')
}

// ───── Run for all candidates ───────────────────────────────────────────────
const candidates = [] // { sectionTitle, variantTitle, suffix, sourceLabel, info }

for (const section of SECTIONS) {
  for (const variant of VARIANTS) {
    const file = `${section.prefix}-${variant.suffix}.log`
    const fullPath = join(LOGS_DIR, file)
    const sourceLabel = `../logs/${file}`
    try {
      const info = parseLog(fullPath)
      candidates.push({
        sectionTitle: section.title,
        variantTitle: variant.title,
        sectionPrefix: section.prefix,
        cqrsKey: variant.suffix.startsWith('m_cqrs') ? 'mCQRS' : 'Classical',
        modeKey: variant.suffix.endsWith('-load') ? 'load' : 'seq',
        sourceLabel,
        info
      })
    } catch (e) {
      console.error('skip', file, e.message)
    }
  }
}

// ───── Build markdown ───────────────────────────────────────────────────────
const md = []
md.push('<!-- markdownlint-disable MD024 MD040 MD013 -->')
md.push('')
md.push('# Анализ логов (без первых 10 секунд)')
md.push('')
md.push('Те же расчёты, что и в [analyz.md](analyz.md), но из каждого лога **исключены первые 10 секунд нагрузки** (отрезаются запросы, у которых `http.request.startedAt < t0 + 10000ms`, где `t0` — `startedAt` самого первого `http.request` в логе). Якорь — первый запрос, а не первая запись лога, чтобы пропустить именно прогрев нагрузки, а не серверный boot/idle.')
md.push('')
md.push('Метрики вычислены из telemetry-спанов:')
md.push('')
md.push('- **http.request** — `durationMs` спана `http.request` (полное время обработки HTTP-запроса).')
md.push('- **consistency_lag** — `(event.handle.endedAt) − http.request.startedAt`, то есть время от прихода запроса до завершения последнего event handler (только для команд POST/PATCH; GET не имеет ивент-хендлера).')
md.push('')
md.push('Pino `responseTime` НЕ используется.')

// Per-section / per-variant blocks
const bySection = new Map()
for (const c of candidates) {
  if (!bySection.has(c.sectionTitle)) bySection.set(c.sectionTitle, [])
  bySection.get(c.sectionTitle).push(c)
}

for (const [sectionTitle, items] of bySection) {
  md.push('')
  md.push(`## ${sectionTitle}`)
  for (const item of items) {
    md.push('')
    md.push(`### ${item.variantTitle}`)
    md.push('')
    md.push('```')
    md.push(renderLogBlock(item.sourceLabel, item.info))
    md.push('```')
  }
}

// ───── Summary tables (load mode only) ──────────────────────────────────────
const loadCandidates = candidates.filter((c) => c.modeKey === 'load')

function candLabel(c) {
  const instMap = { 'm7i-gp3': 'M7i gp3', 'm7a-gp3': 'M7a gp3', 'm7g-gp3': 'M7g gp3', 'm7i-io2': 'M7i io2', 'm7a-io2': 'M7a io2', 'm7g-io2': 'M7g io2' }
  return `${instMap[c.sectionPrefix]} ${c.cqrsKey}`
}

function methodStats(c, method, kind /* 'http' | 'cons' */) {
  const reqs = c.info.requests.filter((r) => r.method === method && r.ok)
  const vals = reqs
    .map((r) => (kind === 'http' ? r.httpDuration : r.consistencyLag))
    .filter((v) => typeof v === 'number')
  return stats(vals)
}

function overallErrorRate(c) {
  const all = c.info.requests
  if (all.length === 0) return 0
  const fails = all.filter((r) => !r.ok).length
  return (fails / all.length) * 100
}

function renderSummary(metric /* 'avg'|'median'|'p90'|'p95'|'range'|'variance'|'stdev' */, includeErr = false) {
  const cols = includeErr
    ? ['Err', 'POST req', 'POST cons', 'PATCH req', 'PATCH cons', 'GET req']
    : ['POST req', 'POST cons', 'PATCH req', 'PATCH cons', 'GET req']
  const head = '| Candidate         | ' + cols.map((c) => c.padStart(8)).join(' | ') + ' |'
  const align =
    '|:------------------|' + cols.map((c) => ' '.repeat(Math.max(0, 8 - 7)) + '-------:').join('|') + '|'
  const rows = [head, align]
  for (const c of loadCandidates) {
    const label = candLabel(c).padEnd(17)
    const cells = []
    if (includeErr) cells.push(overallErrorRate(c).toFixed(2) + '%')
    const post = methodStats(c, 'POST', 'http')
    const postC = methodStats(c, 'POST', 'cons')
    const patch = methodStats(c, 'PATCH', 'http')
    const patchC = methodStats(c, 'PATCH', 'cons')
    const get = methodStats(c, 'GET', 'http')
    for (const s of [post, postC, patch, patchC, get]) {
      cells.push(s ? s[metric].toFixed(2) : '-')
    }
    rows.push(`| ${label} | ` + cells.map((x) => x.padStart(8)).join(' | ') + ' |')
  }
  return rows.join('\n')
}

md.push('')
md.push('## Summary')
md.push('')
md.push('Сравнение всех кандидатов **после отбрасывания первых 10 секунд логов**. Метрики:')
md.push('')
md.push('- **Error rate** — общая доля неудачных запросов (по всем методам, после фильтра).')
md.push('- **req** — `http.request.durationMs`.')
md.push('- **cons** — `consistency_lag = event_handler_end − http.request.startedAt` (для GET нет).')
md.push('')
md.push('Для каждой пары (request-time / consistency-lag) показаны: **avg, median, p90, p95, range, variance, stdev**.')
md.push('')
md.push('### Load mode — avg')
md.push('')
md.push(renderSummary('avg', true))
md.push('')
md.push('### Load mode — median')
md.push('')
md.push(renderSummary('median', false))
md.push('')
md.push('### Load mode — p90')
md.push('')
md.push(renderSummary('p90', false))
md.push('')
md.push('### Load mode — p95')
md.push('')
md.push(renderSummary('p95', false))
md.push('')
md.push('### Load mode — range (max − min)')
md.push('')
md.push(renderSummary('range', false))
md.push('')
md.push('### Load mode — variance')
md.push('')
md.push(renderSummary('variance', false))
md.push('')
md.push('### Load mode — stdev')
md.push('')
md.push(renderSummary('stdev', false))
md.push('')

writeFileSync(OUT_FILE, md.join('\n'))
console.log('Wrote', OUT_FILE)
console.log('Candidates:', candidates.length)
for (const c of candidates) {
  console.log(`  ${c.sectionPrefix} ${c.cqrsKey} ${c.modeKey}: total=${c.info.totalRequests}, after-skip=${c.info.requests.length}`)
}
