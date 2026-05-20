#!/usr/bin/env node
// Compare our *-load stats (computed from logs10/) with the numbers in
// apps/logs/analyz-10.md, side-by-side, with Δabs and Δ%.
//
// Mapping (our metric ↔ analyz-10 metric):
//   GET   responseTime                    ↔ GET   http.request
//   POST  responseTime                    ↔ POST  http.request
//   POST  req_start → last event.handle end ↔ POST  consistency_lag
//   PATCH responseTime                    ↔ PATCH http.request
//   PATCH req_start → last event.handle end ↔ PATCH consistency_lag
//
// analyz-10 reports stats only over *successful* requests (success === true).
// To make the comparison apples-to-apples, we apply the same filter here.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, 'logs10')
const ANALYZ_10 = join(HERE, '..', 'logs', 'analyz-10.md')
const OUT = join(HERE, 'log-load-vs-analyz10.md')

const LOG_FILES = [
  'm7i-gp3-m_cqrs-load.log',
  'm7i-io2-m_cqrs-load.log',
  'm7a-gp3-m_cqrs-load.log',
  'm7a-io2-m_cqrs-load.log',
]

// ─── Parse analyz-10.md to reference numbers ─────────────────────────────
function parseAnalyz10(text) {
  const result = {} // {filename: {method: {http.request|consistency_lag: stats}}}
  const sources = [...text.matchAll(/Source:\s*\.\.\/logs\/([^\s\n]+\.log)/g)]
  for (let i = 0; i < sources.length; i++) {
    const filename = sources[i][1]
    const start = sources[i].index
    const end = i + 1 < sources.length ? sources[i + 1].index : text.length
    const block = text.slice(start, end)
    result[filename] = {}
    const methods = [...block.matchAll(/═══\s+(\w+)[^═]*?═══/g)]
    for (let j = 0; j < methods.length; j++) {
      const method = methods[j][1]
      const mStart = methods[j].index
      const mEnd = j + 1 < methods.length ? methods[j + 1].index : block.length
      const section = block.slice(mStart, mEnd)
      result[filename][method] = {}
      const dataRe = /(?:^|\n)\s*(?:★\s+)?(http\.request|consistency_lag)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/g
      let m
      while ((m = dataRe.exec(section)) !== null) {
        const [, name, count, avg, median, p90, p95, min, max, range, variance, stdev] = m
        result[filename][method][name] = {
          count: parseInt(count, 10),
          mean: parseFloat(avg),
          median: parseFloat(median),
          p90: parseFloat(p90),
          p95: parseFloat(p95),
          variance: parseFloat(variance),
          stdev: parseFloat(stdev),
        }
      }
    }
  }
  return result
}

// ─── Compute our stats over OK-only requests ─────────────────────────────
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
      r = { method: null, httpStart: null, httpDur: null, ok: null, spans: Object.create(null) }
      byReq.set(rid, r)
    }
    if (!r.method) r.method = req.method
    if (sp === 'http.request') {
      r.httpStart = st ?? r.httpStart
      r.httpDur = d ?? r.httpDur
      // analyz-10's "ok" filter: success === true AND status ∈ [200, 400)
      const status = e.status
      const success = e.success === true
      r.ok = success && typeof status === 'number' && status >= 200 && status < 400
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
  const variance = vals.reduce((a, x) => a + (x - mean) ** 2, 0) / n
  return {
    count: n, mean, median, p90: pick(0.9), p95: pick(0.95),
    variance, stdev: Math.sqrt(variance),
  }
}

function computeOurs(filename) {
  const byReq = parse(join(LOGS, filename))
  const out = { GET: {}, POST: {}, PATCH: {} }
  const bucket = { GET: [], POST: [], PATCH: [] }
  const consBucket = { POST: [], PATCH: [] }
  for (const r of byReq.values()) {
    if (!r.method || r.httpDur == null) continue
    if (r.ok !== true) continue
    if (!bucket[r.method]) continue
    bucket[r.method].push(r.httpDur)
    if (r.method === 'POST' || r.method === 'PATCH') {
      const hs = r.spans['event.handle'] || []
      if (hs.length > 0 && r.httpStart != null) {
        const end = Math.max(...hs.map(([st, d]) => st + d))
        consBucket[r.method].push(end - r.httpStart)
      }
    }
  }
  for (const m of ['GET', 'POST', 'PATCH']) {
    out[m]['http.request'] = stats(bucket[m])
  }
  for (const m of ['POST', 'PATCH']) {
    out[m]['consistency_lag'] = stats(consBucket[m])
  }
  return out
}

// ─── Render comparison ───────────────────────────────────────────────────
function deltaPct(mine, ref) {
  if (ref === 0) return mine === 0 ? 0 : Infinity
  return (mine - ref) / ref * 100
}

const STAT_KEYS = ['count', 'mean', 'median', 'p90', 'p95', 'variance', 'stdev']

function renderComparison(filename, ours, ref) {
  const lines = []
  lines.push(`## ${filename}`)
  lines.push('')

  // Iterate each method in METHOD_ORDER × metric in {http.request, consistency_lag}
  const METHODS = ['POST', 'PATCH', 'GET']
  // Build rows: { method, metric, stat, mine, ref, dAbs, dPct }
  const rows = []
  for (const method of METHODS) {
    const metricList = method === 'GET' ? ['http.request'] : ['http.request', 'consistency_lag']
    for (const metric of metricList) {
      const mine = ours[method]?.[metric]
      const r = ref[method]?.[metric]
      if (!mine || !r) continue
      for (const k of STAT_KEYS) {
        const a = mine[k], b = r[k]
        rows.push({
          method, metric, stat: k,
          mine: a, ref: b,
          dAbs: a - b,
          dPct: deltaPct(a, b),
        })
      }
    }
  }

  const fmt = (x, d = 4) => {
    if (x === null || x === undefined || Number.isNaN(x)) return '–'
    if (!Number.isFinite(x)) return x > 0 ? '+∞' : '−∞'
    if (Math.abs(x) >= 1000) return x.toFixed(2)
    return x.toFixed(d)
  }
  const fmtInt = (x) => (x == null ? '–' : Math.round(x).toString())
  const fmtPct = (x) => {
    if (x === null || x === undefined || Number.isNaN(x)) return '–'
    if (!Number.isFinite(x)) return x > 0 ? '+∞%' : '−∞%'
    const sign = x >= 0 ? '+' : ''
    return `${sign}${x.toFixed(3)}%`
  }

  // Determine column widths
  const cells = rows.map((r) => [
    r.method,
    r.metric,
    r.stat,
    r.stat === 'count' ? fmtInt(r.mine) : fmt(r.mine, 4),
    r.stat === 'count' ? fmtInt(r.ref) : fmt(r.ref, 4),
    r.stat === 'count' ? fmtInt(r.dAbs) : fmt(r.dAbs, 4),
    fmtPct(r.dPct),
  ])
  const headers = ['method', 'metric', 'stat', 'mine', 'analyz-10', 'Δabs', 'Δ%']
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map((c) => c[i].length))
  )
  const padL = (s, w) => s + ' '.repeat(Math.max(0, w - s.length))
  const padR = (s, w) => ' '.repeat(Math.max(0, w - s.length)) + s
  // method, metric, stat — left align; numbers — right align
  const align = (i) => (i < 3 ? padL : padR)
  lines.push('| ' + headers.map((h, i) => align(i)(h, widths[i])).join(' | ') + ' |')
  lines.push(
    '|' +
    headers.map((_, i) =>
      i < 3 ? ':' + '-'.repeat(widths[i] + 1) + '|' : '-'.repeat(widths[i] + 1) + ':|'
    ).join('')
  )
  for (const c of cells) {
    lines.push('| ' + c.map((v, i) => align(i)(v, widths[i])).join(' | ') + ' |')
  }
  lines.push('')
  return lines.join('\n')
}

function main() {
  process.stderr.write(`Reading ${ANALYZ_10}...\n`)
  const ref = parseAnalyz10(readFileSync(ANALYZ_10, 'utf-8'))

  const out = []
  out.push('# Сверка *-load с `apps/logs/analyz-10.md`')
  out.push('')
  out.push('Якорь: соответствие наших метрик с метриками из [analyz-10.md](../logs/analyz-10.md):')
  out.push('')
  out.push('| Наша метрика | Метрика в analyz-10 |')
  out.push('|---|---|')
  out.push('| GET responseTime | GET http.request |')
  out.push('| POST responseTime | POST http.request |')
  out.push('| POST `req_start → last event.handle end` | POST consistency_lag |')
  out.push('| PATCH responseTime | PATCH http.request |')
  out.push('| PATCH `req_start → last event.handle end` | PATCH consistency_lag |')
  out.push('')
  out.push('Чтобы числа были сопоставимы apples-to-apples, здесь — в отличие от [log-analisis-load.md](log-analisis-load.md) — мы фильтруем только **успешные** запросы (`success === true` ∧ `200 ≤ status < 400`), как это делает `analyz-10.md`.')
  out.push('')
  out.push('`Δabs = mine − analyz10`, `Δ% = (mine − analyz10) / analyz10 × 100`.')
  out.push('')

  // Track max abs Δ% for summary
  let maxAbsDeltaPct = 0
  let maxAbsRow = null

  for (const fname of LOG_FILES) {
    process.stderr.write(`Computing ours for ${fname}...\n`)
    const ours = computeOurs(fname)
    const r = ref[fname] || {}
    out.push(renderComparison(fname, ours, r))

    // Update max
    for (const method of ['GET', 'POST', 'PATCH']) {
      const metricList = method === 'GET' ? ['http.request'] : ['http.request', 'consistency_lag']
      for (const metric of metricList) {
        const mine = ours[method]?.[metric]
        const refS = r[method]?.[metric]
        if (!mine || !refS) continue
        for (const k of STAT_KEYS) {
          const dPct = Math.abs(deltaPct(mine[k], refS[k]))
          if (Number.isFinite(dPct) && dPct > maxAbsDeltaPct) {
            maxAbsDeltaPct = dPct
            maxAbsRow = { fname, method, metric, stat: k, mine: mine[k], ref: refS[k] }
          }
        }
      }
    }
  }

  out.unshift('')
  out.unshift(`**Максимальная относительная ошибка по всем строкам**: ${maxAbsDeltaPct.toFixed(4)}% (${maxAbsRow ? `${maxAbsRow.fname} / ${maxAbsRow.method} / ${maxAbsRow.metric} / ${maxAbsRow.stat}: mine=${maxAbsRow.mine}, analyz-10=${maxAbsRow.ref}` : '—'}).`)

  writeFileSync(OUT, out.join('\n'))
  process.stderr.write(`Wrote ${OUT}\n`)
}

main()
