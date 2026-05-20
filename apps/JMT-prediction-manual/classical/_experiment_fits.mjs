#!/usr/bin/env node
// Compute distribution parameters for two experiments:
//
//   Experiment 1: Lognormal MLE on EVERY (machine, station, class).
//   Experiment 2: Brunnert per-station heuristic by CV²,
//                 with family FIXED across machines by m7a-gp3 CV²
//                 (= the base for K-prediction):
//                   CV²(m7a-gp3) < 0.5        →  Erlang-k,  k = max(2, round(1/CV²))
//                   0.5 ≤ CV²(m7a-gp3) ≤ 1.5  →  Exponential
//                   CV²(m7a-gp3) > 1.5        →  Lognormal MLE
//
// Compares KS distance for both experiments on the same data.
//
// Outputs:
//   experiment-fits.json  — params + KS per (machine, station, class)
//   docs/experiment-design.md (separately, hand-written from this data)

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, 'logs10-noretry')
const OUT_JSON = join(HERE, 'experiment-fits.json')

const MACHINES = [
  'm7i-gp3-classical_cqrs',
  'm7i-io2-classical_cqrs',
  'm7a-gp3-classical_cqrs',
  'm7a-io2-classical_cqrs',
]
const BASE_FOR_BRUNNERT = 'm7a-gp3-classical_cqrs' // K-prediction base

// ─── Per-request metric definitions (== _analyze_seq.mjs) ──────────────────
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

// ─── Math helpers ──────────────────────────────────────────────────────────
function erf(x) {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x)
  return sign * y
}
const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2))
const lognormCdf = (x, mu, sigma) => x <= 0 ? 0 : normalCdf((Math.log(x) - mu) / sigma)
const expCdf = (x, rate) => x <= 0 ? 0 : 1 - Math.exp(-rate * x)
// Erlang(k, rate) CDF = 1 - sum_{n=0}^{k-1} (rate*x)^n / n! * exp(-rate*x)
function erlangCdf(x, k, rate) {
  if (x <= 0) return 0
  const z = rate * x
  let term = Math.exp(-z)
  let sum = term
  for (let n = 1; n < k; n++) {
    term *= z / n
    sum += term
  }
  return 1 - sum
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
  const logs = pos.map(Math.log)
  const mu = logs.reduce((a, b) => a + b, 0) / logs.length
  const s2 = logs.reduce((a, x) => a + (x - mu) ** 2, 0) / logs.length
  return { mu, sigma: Math.sqrt(s2), n: pos.length }
}

function ksLognormal(vals, mu, sigma) {
  const s = vals.filter((x) => x > 0).sort((a, b) => a - b)
  const n = s.length
  let maxD = 0
  for (let i = 0; i < n; i++) {
    const F = lognormCdf(s[i], mu, sigma)
    const d1 = Math.abs((i + 1) / n - F)
    const d2 = Math.abs(i / n - F)
    if (d1 > maxD) maxD = d1
    if (d2 > maxD) maxD = d2
  }
  return maxD
}
function ksExp(vals, rate) {
  const s = vals.filter((x) => x > 0).sort((a, b) => a - b)
  const n = s.length
  let maxD = 0
  for (let i = 0; i < n; i++) {
    const F = expCdf(s[i], rate)
    const d1 = Math.abs((i + 1) / n - F)
    const d2 = Math.abs(i / n - F)
    if (d1 > maxD) maxD = d1
    if (d2 > maxD) maxD = d2
  }
  return maxD
}
function ksErlang(vals, k, rate) {
  const s = vals.filter((x) => x > 0).sort((a, b) => a - b)
  const n = s.length
  let maxD = 0
  for (let i = 0; i < n; i++) {
    const F = erlangCdf(s[i], k, rate)
    const d1 = Math.abs((i + 1) / n - F)
    const d2 = Math.abs(i / n - F)
    if (d1 > maxD) maxD = d1
    if (d2 > maxD) maxD = d2
  }
  return maxD
}

// ─── Run ───────────────────────────────────────────────────────────────────
const METRICS = buildMetrics()
const METHODS = ['GET', 'POST', 'PATCH']

// Pass 1: collect samples per (machine, method, metric)
const samples = {} // {machine: {method: {metric: [vals]}}}
for (const mach of MACHINES) {
  process.stderr.write(`Parsing ${mach}-seq.log...\n`)
  const byReq = parse(join(LOGS, `${mach}-seq.log`))
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

// Pass 2: per (method, metric), determine Brunnert family from m7a-gp3 CV²
const brunnert = {} // {method: {metric: {family: 'lognormal'|'exp'|'erlang', k?: int}}}
for (const method of METHODS) {
  brunnert[method] = {}
  for (const name of Object.keys(METRICS[method])) {
    const baseVals = samples[BASE_FOR_BRUNNERT][method][name]
    if (!baseVals || baseVals.length < 20) {
      brunnert[method][name] = { family: 'lognormal' }
      continue
    }
    const st = stats(baseVals)
    let decision
    if (st.cv2 < 0.5) {
      const k = Math.max(2, Math.round(1 / Math.max(st.cv2, 0.01)))
      decision = { family: 'erlang', k, baseCv2: st.cv2 }
    } else if (st.cv2 <= 1.5) {
      decision = { family: 'exp', baseCv2: st.cv2 }
    } else {
      decision = { family: 'lognormal', baseCv2: st.cv2 }
    }
    brunnert[method][name] = decision
  }
}

// Pass 3: for each (machine, method, metric), compute params + KS for both
//         experiments.
const result = {} // {machine: {method: {metric: {stats, exp1, exp2}}}}
for (const mach of MACHINES) {
  result[mach] = { GET: {}, POST: {}, PATCH: {} }
  for (const method of METHODS) {
    for (const name of Object.keys(METRICS[method])) {
      const vals = samples[mach][method][name]
      if (!vals || vals.length < 20) continue
      const st = stats(vals)
      // Experiment 1: LN MLE everywhere
      const ln = mleLognormal(vals)
      const ksLn = ksLognormal(vals, ln.mu, ln.sigma)
      // Experiment 2: Brunnert family
      const dec = brunnert[method][name]
      let exp2Params, exp2Ks
      if (dec.family === 'lognormal') {
        exp2Params = { family: 'lognormal', mu: ln.mu, sigma: ln.sigma }
        exp2Ks = ksLn
      } else if (dec.family === 'exp') {
        const rate = st.mean > 0 ? 1 / st.mean : 0
        exp2Params = { family: 'exp', rate, mean: st.mean }
        exp2Ks = ksExp(vals, rate)
      } else { // erlang
        const k = dec.k
        const rate = st.mean > 0 ? k / st.mean : 0
        exp2Params = { family: 'erlang', k, rate, mean: st.mean }
        exp2Ks = ksErlang(vals, k, rate)
      }
      result[mach][method][name] = {
        n: vals.length,
        mean: st.mean,
        median: st.median,
        variance: st.variance,
        cv2: st.cv2,
        exp1: { family: 'lognormal', mu: ln.mu, sigma: ln.sigma, ks: ksLn },
        exp2: { ...exp2Params, ks: exp2Ks, brunnertBaseCv2: dec.baseCv2 },
      }
    }
  }
}

writeFileSync(OUT_JSON, JSON.stringify({ brunnertDecisions: brunnert, perMachine: result }, null, 2))
process.stderr.write(`Wrote ${OUT_JSON}\n`)

// ─── Summary tables to stdout ───────────────────────────────────────────────
function fmt(x, d = 3) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return x.toFixed(d)
}

console.log('\n══════ Experiment 2 (Brunnert) decisions per (station, class) ══════')
console.log(`(based on m7a-gp3 CV²)`)
console.log('-'.repeat(80))
for (const method of METHODS) {
  for (const name of Object.keys(METRICS[method])) {
    const dec = brunnert[method][name]
    const params = dec.family === 'erlang' ? ` k=${dec.k}` : ''
    console.log(`  ${method} ${name}  →  ${dec.family}${params}  (base CV²=${fmt(dec.baseCv2, 2)})`)
  }
}

console.log('\n══════ KS comparison per machine ══════')
const totals = { exp1: { ks: [], wins: 0 }, exp2: { ks: [], wins: 0 } }
for (const mach of MACHINES) {
  console.log(`\n--- ${mach} ---`)
  console.log(`  ${'station/class'.padEnd(60)}  ${'CV²'.padStart(6)}  ${'KS_exp1'.padStart(8)}  ${'KS_exp2'.padStart(8)}  ${'family_exp2'}`)
  for (const method of METHODS) {
    for (const name of Object.keys(METRICS[method])) {
      const r = result[mach][method][name]
      if (!r) continue
      const fam = r.exp2.family + (r.exp2.k ? `-${r.exp2.k}` : '')
      const winner = r.exp1.ks < r.exp2.ks ? '🟢exp1' : '🔵exp2'
      console.log(`  ${name.padEnd(60)}  ${fmt(r.cv2, 2).padStart(6)}  ${fmt(r.exp1.ks).padStart(8)}  ${fmt(r.exp2.ks).padStart(8)}  ${fam.padEnd(11)}  ${winner}`)
      totals.exp1.ks.push(r.exp1.ks); totals.exp2.ks.push(r.exp2.ks)
      if (r.exp1.ks < r.exp2.ks) totals.exp1.wins++; else totals.exp2.wins++
    }
  }
}

console.log('\n══════ Aggregate ══════')
const meanKs = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
console.log(`  exp1 (LN MLE everywhere):  mean KS=${fmt(meanKs(totals.exp1.ks))},  wins=${totals.exp1.wins}/${totals.exp1.ks.length}`)
console.log(`  exp2 (Brunnert per CV²):   mean KS=${fmt(meanKs(totals.exp2.ks))},  wins=${totals.exp2.wins}/${totals.exp2.ks.length}`)
