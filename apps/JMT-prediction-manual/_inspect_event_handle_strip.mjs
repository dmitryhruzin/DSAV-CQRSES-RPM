#!/usr/bin/env node
// Verify the retry-strip at the lowest level: distribution of *raw*
// event.handle.durationMs spans (no per-request composition, no minus DB).
// Compares logs10/ (raw) vs logs10-noretry/ (after _strip_retries.mjs).
//
// Splits by req.method (POST vs PATCH) since event.handle only fires for
// commands. Writes a markdown table to event-handle-strip-verification.md.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'event-handle-strip-verification.md')

const FILES = [
  'm7i-gp3-m_cqrs-seq.log',
  'm7i-io2-m_cqrs-seq.log',
  'm7a-gp3-m_cqrs-seq.log',
  'm7a-io2-m_cqrs-seq.log',
  'm7i-gp3-m_cqrs-load.log',
  'm7i-io2-m_cqrs-load.log',
  'm7a-gp3-m_cqrs-load.log',
  'm7a-io2-m_cqrs-load.log',
]

function stats(vals) {
  const n = vals.length
  if (n === 0) return null
  const s = [...vals].sort((a, b) => a - b)
  const sum = vals.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2
  const pick = (p) => s[Math.min(n - 1, Math.floor(p * (n - 1) + 0.5))]
  const variance = vals.reduce((a, x) => a + (x - mean) ** 2, 0) / n
  const stdev = Math.sqrt(variance)
  const cv2 = mean !== 0 ? variance / (mean * mean) : 0
  return {
    n, mean, median,
    p90: pick(0.90), p95: pick(0.95), p99: pick(0.99),
    max: s[n - 1], variance, stdev, cv2,
  }
}

function loadHandlers(path) {
  // Returns { POST: [durations], PATCH: [durations] }
  const out = { POST: [], PATCH: [] }
  const lines = readFileSync(path, 'utf-8').split('\n')
  for (const ln of lines) {
    if (!ln) continue
    let e
    try { e = JSON.parse(ln) } catch { continue }
    if (e.span !== 'event.handle' || typeof e.durationMs !== 'number') continue
    const m = (e.req || {}).method
    if (m === 'POST' || m === 'PATCH') out[m].push(e.durationMs)
  }
  return out
}

function fmtFloat(x, digits = 3) {
  if (x === null || x === undefined || Number.isNaN(x)) return '–'
  if (Math.abs(x) >= 100) return x.toFixed(2)
  return x.toFixed(digits)
}

const md = []
md.push('# Strip-верификация: распределение `event.handle.durationMs`')
md.push('')
md.push('Прямое сравнение **per-span** длительностей `event.handle` (без вычитания db.projection.*, без max-end на запрос). Источники: [logs10/](logs10/) (сырые, с retry-инфляцией) vs [logs10-noretry/](logs10-noretry/) (после [_strip_retries.mjs](_strip_retries.mjs)). Группировка — по методу HTTP-запроса (event.handle бывает только у POST и PATCH).')
md.push('')
md.push('Колонки: `n` — количество event.handle спанов, остальные — стандартная статистика (population, в **мс**). `Δ` рассчитан как `(after − before) / before × 100%`.')
md.push('')

for (const fname of FILES) {
  const raw = loadHandlers(join(HERE, 'logs10', fname))
  const clean = loadHandlers(join(HERE, 'logs10-noretry', fname))
  md.push(`## ${fname}`)
  md.push('')
  md.push('| method | source | n | mean | median | p90 | p95 | p99 | max | variance | stdev | CV² |')
  md.push('|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const method of ['POST', 'PATCH']) {
    const r = stats(raw[method])
    const c = stats(clean[method])
    if (!r) continue
    const fmtRow = (src, s) =>
      `| ${method} | ${src} | ${s.n} | ${fmtFloat(s.mean)} | ${fmtFloat(s.median)} | ` +
      `${fmtFloat(s.p90)} | ${fmtFloat(s.p95)} | ${fmtFloat(s.p99)} | ${fmtFloat(s.max)} | ` +
      `${fmtFloat(s.variance)} | ${fmtFloat(s.stdev)} | ${fmtFloat(s.cv2)} |`
    md.push(fmtRow('logs10 (raw)', r))
    md.push(fmtRow('logs10-noretry', c))
    if (r && c) {
      const dPct = (k) => {
        if (r[k] === 0) return c[k] === 0 ? '0%' : '∞'
        return (((c[k] - r[k]) / r[k]) * 100).toFixed(1) + '%'
      }
      md.push(
        `| ${method} | **Δ%** | ${dPct('n')} | ${dPct('mean')} | ${dPct('median')} | ` +
        `${dPct('p90')} | ${dPct('p95')} | ${dPct('p99')} | ${dPct('max')} | ` +
        `${dPct('variance')} | ${dPct('stdev')} | ${dPct('cv2')} |`
      )
    }
  }
  md.push('')
}

writeFileSync(OUT, md.join('\n'))
console.log('Wrote', OUT)
