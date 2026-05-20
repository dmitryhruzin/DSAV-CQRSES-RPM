#!/usr/bin/env node
// Compare two Lognormal fitting strategies on the per-request metrics from
// logs10-noretry/*-seq.log:
//
//   - moments fit:  σ² = ln(1 + Var/μ²),  μ_log = ln(μ) − σ²/2
//                   (calibrates by sample mean and variance)
//   - MLE fit:      μ_log = mean(ln(x_i)),  σ²_log = mean((ln x_i − μ_log)²)
//                   (calibrates by mean and variance of log-samples;
//                    robust to heavy tails)
//
// For each fit we compute the Kolmogorov-Smirnov distance vs the empirical
// CDF. Smaller KS is a better fit.
//
// Output: log-fit-comparison.md — one row per (machine, method, metric),
// with KS for both fits + a winner badge.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, 'logs10-noretry')
const OUT = join(HERE, 'log-fit-comparison.md')

const FILES = [
  'm7i-gp3-m_cqrs-seq.log',
  'm7i-io2-m_cqrs-seq.log',
  'm7a-gp3-m_cqrs-seq.log',
  'm7a-io2-m_cqrs-seq.log',
]

// ─── Span aggregation per request (same as _analyze_seq.mjs) ────────────────
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
    responseTime: (r) => r.httpDur,
    'query.execute − db.projection.read': (r) =>
      sumSpan(r, 'query.execute') - sumSpan(r, 'db.projection.read'),
    'db.projection.read': (r) => sumSpan(r, 'db.projection.read'),
  }
  const cmdBase = {
    responseTime: (r) => r.httpDur,
    'req_start → last event.handle end': handlerEnd,
    'command.execute + event.publishAll − db.eventstore.write − db.snapshot.read − db.snapshot.write':
      (r) =>
        sumSpan(r, 'command.execute') + sumSpan(r, 'event.publishAll') -
        sumSpan(r, 'db.eventstore.write') - sumSpan(r, 'db.snapshot.read') - sumSpan(r, 'db.snapshot.write'),
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
      sumSpan(r, 'event.handle') - sumSpan(r, 'db.projection.read') - sumSpan(r, 'db.projection.write'),
    'db.projection.read': (r) => sumSpan(r, 'db.projection.read'),
    'db.projection.write': (r) => sumSpan(r, 'db.projection.write'),
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

// ─── Math helpers ───────────────────────────────────────────────────────────
function erf(x) {
  // Abramowitz & Stegun 7.1.26 approximation, ~1.5e-7 max error.
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t) + a3) * t + a2) * t * a1 * 0 // placeholder
  const _y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x)
  return sign * _y
}
function normalCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)) }
function lognormCdf(x, mu, sigma) {
  if (x <= 0) return 0
  return normalCdf((Math.log(x) - mu) / sigma)
}

// ─── Fits ───────────────────────────────────────────────────────────────────
function momentsFit(vals) {
  const n = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / n
  const v = vals.reduce((a, x) => a + (x - mean) ** 2, 0) / n
  if (mean <= 0 || v <= 0) return null
  const cv2 = v / (mean * mean)
  const sigma2 = Math.log(1 + cv2)
  const sigma = Math.sqrt(sigma2)
  const mu = Math.log(mean) - sigma2 / 2
  return { mu, sigma, mean, variance: v, cv2 }
}

function mleFit(vals) {
  // Lognormal MLE = fit normal to ln(samples). Requires all samples > 0.
  const pos = vals.filter((x) => x > 0)
  if (pos.length === 0) return null
  const logs = pos.map(Math.log)
  const mu = logs.reduce((a, b) => a + b, 0) / logs.length
  const sigma2 = logs.reduce((a, x) => a + (x - mu) ** 2, 0) / logs.length
  const sigma = Math.sqrt(sigma2)
  return { mu, sigma, nUsed: pos.length, nSkipped: vals.length - pos.length }
}

function ksDistance(vals, mu, sigma) {
  const sorted = [...vals].sort((a, b) => a - b)
  const n = sorted.length
  let maxD = 0
  for (let i = 0; i < n; i++) {
    const x = sorted[i]
    const empAbove = (i + 1) / n
    const empBelow = i / n
    const cdf = lognormCdf(x, mu, sigma)
    const d1 = Math.abs(empAbove - cdf)
    const d2 = Math.abs(empBelow - cdf)
    if (d1 > maxD) maxD = d1
    if (d2 > maxD) maxD = d2
  }
  return maxD
}

// ─── Run ────────────────────────────────────────────────────────────────────
const METRICS = buildMetrics()
const METHOD_ORDER = ['GET', 'POST', 'PATCH']

const rows = [] // {file, method, metric, n, mom, mle, ks_mom, ks_mle}

for (const fname of FILES) {
  const byReq = parse(join(LOGS, fname))
  for (const method of METHOD_ORDER) {
    const samples = {}
    for (const name of Object.keys(METRICS[method])) samples[name] = []
    for (const r of byReq.values()) {
      if (r.method !== method || r.httpDur == null) continue
      for (const [name, fn] of Object.entries(METRICS[method])) {
        const v = fn(r)
        if (v !== null && v !== undefined && !Number.isNaN(v)) samples[name].push(v)
      }
    }
    for (const name of Object.keys(METRICS[method])) {
      const vals = samples[name]
      if (vals.length < 20) continue
      const mom = momentsFit(vals)
      const mle = mleFit(vals)
      if (!mom || !mle) continue
      // For KS, use samples > 0 only (lognormal lives on positive reals)
      const pos = vals.filter((x) => x > 0)
      const ksM = ksDistance(pos, mom.mu, mom.sigma)
      const ksL = ksDistance(pos, mle.mu, mle.sigma)
      rows.push({
        file: fname, method, metric: name, n: vals.length, nPos: pos.length,
        mean: mom.mean, cv2: mom.cv2,
        mom: { mu: mom.mu, sigma: mom.sigma, ks: ksM },
        mle: { mu: mle.mu, sigma: mle.sigma, ks: ksL },
      })
    }
  }
}

// ─── Render ─────────────────────────────────────────────────────────────────
const md = []
md.push('# Fit-сравнение: Lognormal moments vs MLE')
md.push('')
md.push('Сравнение двух способов калибровки Lognormal по seq-сэмплам ([logs10-noretry/](logs10-noretry/), per-request):')
md.push('')
md.push('- **moments**: `σ² = ln(1 + CV²)`, `μ = ln(mean) − σ²/2` — закрытая форма по первому/второму моментам.')
md.push('- **MLE**: `μ = mean(ln xᵢ)`, `σ² = mean((ln xᵢ − μ)²)` — максимум правдоподобия (фит нормали к ln-сэмплам).')
md.push('')
md.push('Качество оценивается по **Kolmogorov-Smirnov distance** между эмпирической CDF и Lognormal-CDF (только по положительным сэмплам). Меньше = лучше. KS < 0.05 — отличный фит, 0.05–0.1 — приемлемый, > 0.1 — плохой.')
md.push('')
md.push('Жирным выделен победитель по KS. `Δ KS = ks_mle − ks_mom` (отрицательное = MLE лучше).')
md.push('')

let momWins = 0, mleWins = 0
for (const fname of FILES) {
  md.push(`## ${fname}`)
  md.push('')
  md.push('| method | metric | n | mean | CV² | μ_mom | σ_mom | KS_mom | μ_mle | σ_mle | KS_mle | Δ KS | win |')
  md.push('|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|')
  for (const r of rows.filter((x) => x.file === fname)) {
    const dKs = r.mle.ks - r.mom.ks
    const win = r.mle.ks < r.mom.ks ? 'MLE' : 'MOM'
    if (win === 'MLE') mleWins++; else momWins++
    const ksMomStr = win === 'MOM' ? `**${r.mom.ks.toFixed(3)}**` : r.mom.ks.toFixed(3)
    const ksMleStr = win === 'MLE' ? `**${r.mle.ks.toFixed(3)}**` : r.mle.ks.toFixed(3)
    md.push(
      `| ${r.method} | ${r.metric} | ${r.n} | ${r.mean.toFixed(3)} | ${r.cv2.toFixed(2)} | ` +
      `${r.mom.mu.toFixed(3)} | ${r.mom.sigma.toFixed(3)} | ${ksMomStr} | ` +
      `${r.mle.mu.toFixed(3)} | ${r.mle.sigma.toFixed(3)} | ${ksMleStr} | ` +
      `${(dKs >= 0 ? '+' : '') + dKs.toFixed(3)} | ${win} |`
    )
  }
  md.push('')
}

md.unshift('')
md.unshift(`**Итог: MLE выигрывает в ${mleWins} из ${mleWins + momWins} строк (${(100 * mleWins / (mleWins + momWins)).toFixed(0)}%).**`)

writeFileSync(OUT, md.join('\n'))
console.log(`Wrote ${OUT}`)
console.log(`MLE wins: ${mleWins} / ${mleWins + momWins}`)
