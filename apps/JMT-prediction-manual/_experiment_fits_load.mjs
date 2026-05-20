#!/usr/bin/env node
// Эксп 4: Lognormal MLE по LOAD-логам (а не seq).
//
// Идея: seq не видит burst-arrivals, GC pauses, lock contention, cache-warming —
// поэтому seq CV² в 5–9 раз меньше load CV². Калибруясь по load, получаем
// реалистичный σ и должны автоматически попасть в правильную окрестность p95.
//
// Pipeline идентичен _experiment_fits.mjs, только источник — logs10-noretry/*-load.log.
//
// Выход: experiment-fits-load.json (та же структура что experiment-fits.json,
//        но без Brunnert/Hybrid — только LN MLE).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, 'logs10-noretry')
const OUT_JSON = join(HERE, 'experiment-fits-load.json')

const MACHINES = [
  'm7i-gp3-m_cqrs',
  'm7i-io2-m_cqrs',
  'm7a-gp3-m_cqrs',
  'm7a-io2-m_cqrs',
]

function buildMetrics() {
  const sumSpan = (req, name) =>
    (req.spans[name] || []).reduce((s, [, d]) => s + d, 0)
  const handlerEnd = (req) => {
    const hs = req.spans['event.handle'] || []
    if (hs.length === 0 || req.httpStart == null) return null
    const end = Math.max(...hs.map(([st, d]) => st + d))
    return end - req.httpStart
  }
  const GET = {
    'AppService.Zapyty (query.execute − db.projection.read)': (r) =>
      sumSpan(r, 'query.execute') - sumSpan(r, 'db.projection.read'),
    'ProjectionDB.Zapyty (db.projection.read)': (r) => sumSpan(r, 'db.projection.read'),
  }
  const POST = {
    'AppService.Stvor (cmd+pub − ES − SN)': (r) =>
      sumSpan(r, 'command.execute') + sumSpan(r, 'event.publishAll') -
      sumSpan(r, 'db.eventstore.write') - sumSpan(r, 'db.snapshot.read') - sumSpan(r, 'db.snapshot.write'),
    'EventStore.Stvor (db.eventstore.write)': (r) => sumSpan(r, 'db.eventstore.write'),
    'SnapshotDB.Stvor (db.snapshot.r+w)': (r) =>
      sumSpan(r, 'db.snapshot.read') + sumSpan(r, 'db.snapshot.write'),
    'AppService.RC.POST (event.handle − db.projection.write)': (r) =>
      sumSpan(r, 'event.handle') - sumSpan(r, 'db.projection.write'),
    'ProjectionDB.RC.POST (db.projection.write)': (r) => sumSpan(r, 'db.projection.write'),
  }
  const PATCH = {
    'AppService.Onovl (cmd+pub − ES − SN)': (r) =>
      sumSpan(r, 'command.execute') + sumSpan(r, 'event.publishAll') -
      sumSpan(r, 'db.eventstore.write') - sumSpan(r, 'db.snapshot.read') - sumSpan(r, 'db.snapshot.write'),
    'EventStore.Onovl (db.eventstore.write)': (r) => sumSpan(r, 'db.eventstore.write'),
    'SnapshotDB.Onovl (db.snapshot.r+w)': (r) =>
      sumSpan(r, 'db.snapshot.read') + sumSpan(r, 'db.snapshot.write'),
    'AppService.RC.PATCH (event.handle − db.projection.r − db.projection.w)': (r) =>
      sumSpan(r, 'event.handle') - sumSpan(r, 'db.projection.read') - sumSpan(r, 'db.projection.write'),
    'ProjectionDB.RC.PATCH.read (db.projection.read)': (r) => sumSpan(r, 'db.projection.read'),
    'ProjectionDB.RC.PATCH.write (db.projection.write)': (r) => sumSpan(r, 'db.projection.write'),
  }
  return { GET, POST, PATCH }
}

function parse(path) {
  const byReq = new Map()
  for (const ln of readFileSync(path, 'utf-8').split('\n')) {
    if (!ln) continue
    let e
    try { e = JSON.parse(ln) } catch { continue }
    const sp = e.span; if (!sp) continue
    const req = e.req || {}; const rid = req.id; if (!rid) continue
    const d = e.durationMs, st = e.startedAt
    let r = byReq.get(rid)
    if (!r) { r = { method: null, httpStart: null, httpDur: null, spans: Object.create(null) }; byReq.set(rid, r) }
    if (!r.method) r.method = req.method
    if (sp === 'http.request') { r.httpStart = st ?? r.httpStart; r.httpDur = d ?? r.httpDur }
    if (typeof d === 'number' && typeof st === 'number') {
      ;(r.spans[sp] || (r.spans[sp] = [])).push([st, d])
    }
  }
  return byReq
}

function stats(vals) {
  const n = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / n
  const v = vals.reduce((a, x) => a + (x - mean) ** 2, 0) / n
  const cv2 = mean > 0 ? v / (mean * mean) : 0
  const sorted = [...vals].sort((a, b) => a - b)
  const median = n % 2 ? sorted[(n - 1) >> 1] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  return { n, mean, median, variance: v, cv2 }
}

function mleLognormal(vals) {
  const pos = vals.filter((x) => x > 0)
  if (pos.length === 0) return null
  const logs = pos.map(Math.log)
  const mu = logs.reduce((a, b) => a + b, 0) / logs.length
  const s2 = logs.reduce((a, x) => a + (x - mu) ** 2, 0) / logs.length
  return { mu, sigma: Math.sqrt(s2), n: pos.length }
}

// ─── Run ─────────────────────────────────────────────────────────────────
const METRICS = buildMetrics()
const METHODS = ['GET', 'POST', 'PATCH']

const samples = {}
for (const mach of MACHINES) {
  process.stderr.write(`Parsing ${mach}-load.log...\n`)
  const byReq = parse(join(LOGS, `${mach}-load.log`))
  samples[mach] = { GET: {}, POST: {}, PATCH: {} }
  for (const method of METHODS) {
    for (const name of Object.keys(METRICS[method])) samples[mach][method][name] = []
  }
  for (const r of byReq.values()) {
    if (!METHODS.includes(r.method) || r.httpDur == null) continue
    for (const [name, fn] of Object.entries(METRICS[r.method])) {
      const v = fn(r)
      if (v !== null && v !== undefined && !Number.isNaN(v)) samples[mach][r.method][name].push(v)
    }
  }
}

const result = {}
for (const mach of MACHINES) {
  result[mach] = { GET: {}, POST: {}, PATCH: {} }
  for (const method of METHODS) {
    for (const name of Object.keys(METRICS[method])) {
      const vals = samples[mach][method][name]
      if (!vals || vals.length < 20) continue
      const st = stats(vals)
      const ln = mleLognormal(vals)
      if (!ln) continue
      result[mach][method][name] = {
        n: vals.length,
        mean: st.mean,
        median: st.median,
        variance: st.variance,
        cv2: st.cv2,
        exp1: { family: 'lognormal', mu: ln.mu, sigma: ln.sigma },
      }
    }
  }
}

writeFileSync(OUT_JSON, JSON.stringify({ perMachine: result }, null, 2))
process.stderr.write(`Wrote ${OUT_JSON}\n`)

// ─── Quick summary ───────────────────────────────────────────────────────
console.log('\n══════ Load-calibrated LN MLE params (selected) ══════')
console.log('Сравнение seq vs load CV² для m7a-gp3 (база K):')
console.log(`  ${'station/class'.padEnd(55)}  ${'mean_load'.padStart(10)}  ${'CV²_load'.padStart(9)}  ${'σ_load'.padStart(7)}`)
for (const method of METHODS) {
  for (const name of Object.keys(METRICS[method])) {
    const r = result['m7a-gp3-m_cqrs'][method][name]
    if (!r) continue
    console.log(`  ${name.padEnd(55)}  ${r.mean.toFixed(3).padStart(10)}  ${r.cv2.toFixed(2).padStart(9)}  ${r.exp1.sigma.toFixed(3).padStart(7)}`)
  }
}
