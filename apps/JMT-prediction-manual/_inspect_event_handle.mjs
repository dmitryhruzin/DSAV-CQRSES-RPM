#!/usr/bin/env node
// Investigate big event.handle spans in *-seq logs. For each log:
//   - distribution of per-handler event.handle.durationMs
//   - top-20 longest handlers (rid + position in log + duration)
//   - where they sit (start / middle / end) by relative position in the
//     post-warmup window
//   - count of long handlers per request and their per-request RC AppService
//     contribution (event.handle - projection.read - projection.write)

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, 'logs10')

const FILES = [
  'm7i-gp3-m_cqrs-seq.log',
  'm7i-io2-m_cqrs-seq.log',
  'm7a-gp3-m_cqrs-seq.log',
  'm7a-io2-m_cqrs-seq.log',
]

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]
}

for (const fname of FILES) {
  process.stderr.write(`\n══════ ${fname} ══════\n`)
  const text = readFileSync(join(LOGS, fname), 'utf-8')

  // Pass 1: get t0 = min http.request startedAt, t1 = max http.request end
  let t0 = Infinity, t1 = -Infinity
  for (const ln of text.split('\n')) {
    if (!ln) continue
    let e; try { e = JSON.parse(ln) } catch { continue }
    if (e.span === 'http.request' && typeof e.startedAt === 'number') {
      if (e.startedAt < t0) t0 = e.startedAt
      if (typeof e.durationMs === 'number') {
        const end = e.startedAt + e.durationMs
        if (end > t1) t1 = end
      }
    }
  }
  const windowMs = t1 - t0

  // Pass 2: collect all event.handle spans, grouped by req.id; record method
  const handlers = [] // {rid, method, startedAt, durationMs, posMs (relative to t0)}
  const byReq = new Map()
  for (const ln of text.split('\n')) {
    if (!ln) continue
    let e; try { e = JSON.parse(ln) } catch { continue }
    const sp = e.span
    if (!sp) continue
    const req = e.req || {}
    const rid = req.id
    if (!rid) continue
    let r = byReq.get(rid)
    if (!r) {
      r = { method: req.method, spans: Object.create(null) }
      byReq.set(rid, r)
    }
    if (typeof e.durationMs !== 'number' || typeof e.startedAt !== 'number') continue
    ;(r.spans[sp] || (r.spans[sp] = [])).push({ st: e.startedAt, d: e.durationMs })
    if (sp === 'event.handle') {
      handlers.push({
        rid,
        method: req.method,
        st: e.startedAt,
        d: e.durationMs,
        posMs: e.startedAt - t0,
      })
    }
  }

  // ── Per-handler distribution
  const dur = handlers.map((h) => h.d)
  const big = handlers.filter((h) => h.d > 100).length
  const huge = handlers.filter((h) => h.d > 500).length
  const monster = handlers.filter((h) => h.d > 1000).length
  console.log(
    `total event.handle: ${handlers.length}   window: ${(windowMs / 1000).toFixed(1)}s\n` +
    `  durationMs:  mean=${(dur.reduce((a,b)=>a+b,0)/dur.length).toFixed(2)}  ` +
    `median=${pct(dur, 0.5).toFixed(3)}  p90=${pct(dur, 0.9).toFixed(2)}  ` +
    `p95=${pct(dur, 0.95).toFixed(2)}  p99=${pct(dur, 0.99).toFixed(2)}  ` +
    `max=${Math.max(...dur).toFixed(1)}\n` +
    `  long handlers: >100ms=${big}   >500ms=${huge}   >1000ms=${monster}`
  )

  // ── Top-20 longest handlers
  const top = [...handlers].sort((a, b) => b.d - a.d).slice(0, 20)
  console.log(`\n  Top-20 longest event.handle:`)
  console.log(
    `    ${'idx'.padStart(3)}  ${'method'.padEnd(6)}  ` +
    `${'durationMs'.padStart(11)}  ${'pos in window'.padStart(13)}  ${'pos %'.padStart(7)}  req.id`
  )
  top.forEach((h, i) => {
    const pos = `${(h.posMs / 1000).toFixed(1)}s`
    const pct100 = ((h.posMs / windowMs) * 100).toFixed(1) + '%'
    console.log(
      `    ${String(i + 1).padStart(3)}  ${(h.method || '?').padEnd(6)}  ` +
      `${h.d.toFixed(2).padStart(11)}  ${pos.padStart(13)}  ${pct100.padStart(7)}  ${h.rid}`
    )
  })

  // ── Per-request: rc app contribution for PATCH only (matches the analysed metric)
  const rcVals = []
  const rcOutliers = []
  for (const [rid, r] of byReq) {
    if (r.method !== 'PATCH') continue
    const eh = (r.spans['event.handle'] || []).reduce((a, x) => a + x.d, 0)
    const pr = (r.spans['db.projection.read'] || []).reduce((a, x) => a + x.d, 0)
    const pw = (r.spans['db.projection.write'] || []).reduce((a, x) => a + x.d, 0)
    const v = eh - pr - pw
    rcVals.push(v)
    if (v > 100) {
      const firstEh = (r.spans['event.handle'] || [])[0]
      rcOutliers.push({
        rid,
        value: v,
        eh, pr, pw,
        nHandlers: (r.spans['event.handle'] || []).length,
        posMs: firstEh ? firstEh.st - t0 : null,
        nReads: (r.spans['db.projection.read'] || []).length,
        nWrites: (r.spans['db.projection.write'] || []).length,
        maxSingleHandler: Math.max(...(r.spans['event.handle'] || []).map((x) => x.d)),
      })
    }
  }
  console.log(
    `\n  PATCH per-request RC AppService (event.handle − proj.r − proj.w):\n` +
    `    n=${rcVals.length}  mean=${(rcVals.reduce((a,b)=>a+b,0)/rcVals.length).toFixed(2)}  ` +
    `median=${pct(rcVals, 0.5).toFixed(2)}  p95=${pct(rcVals, 0.95).toFixed(2)}  ` +
    `p99=${pct(rcVals, 0.99).toFixed(2)}  max=${Math.max(...rcVals).toFixed(1)}\n` +
    `  outliers (>100ms): ${rcOutliers.length} requests`
  )
  if (rcOutliers.length > 0) {
    rcOutliers.sort((a, b) => b.value - a.value)
    console.log(
      `    ${'rank'.padStart(4)}  ${'value'.padStart(8)}  ${'Σ eh'.padStart(8)}  ` +
      `${'Σ pr'.padStart(6)}  ${'Σ pw'.padStart(6)}  ${'maxEh'.padStart(8)}  ` +
      `${'#handlers'.padStart(9)}  ${'pos %'.padStart(7)}  req.id`
    )
    rcOutliers.slice(0, 15).forEach((o, i) => {
      const pct100 = o.posMs != null ? ((o.posMs / windowMs) * 100).toFixed(1) + '%' : '–'
      console.log(
        `    ${String(i + 1).padStart(4)}  ${o.value.toFixed(2).padStart(8)}  ` +
        `${o.eh.toFixed(2).padStart(8)}  ${o.pr.toFixed(2).padStart(6)}  ` +
        `${o.pw.toFixed(2).padStart(6)}  ${o.maxSingleHandler.toFixed(2).padStart(8)}  ` +
        `${String(o.nHandlers).padStart(9)}  ${pct100.padStart(7)}  ${o.rid}`
      )
    })
  }
}
