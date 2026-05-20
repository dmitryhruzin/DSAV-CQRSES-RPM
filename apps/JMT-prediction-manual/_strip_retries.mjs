#!/usr/bin/env node
// Detect VersionMismatch-retry inflation in event.handle spans and write
// "cleaned" logs to logs10-noretry/.
//
// Mechanism (cross-checked in apps/m-cqrs/src/**/projections/*.ts):
//   On VersionMismatchError, the projection handler `await setTimeout(1000)`
//   then recursively retries (up to 3 attempts). The whole retry chain runs
//   inside one outer event.handle span, so its `durationMs` is inflated by
//   exactly 1000 ms × N_retries.
//
// Real handler work is <10 ms in seq mode and <100 ms even under load, so any
// event.handle with durationMs > THRESHOLD almost certainly absorbed retries.
//
// For each affected event.handle line we:
//   - compute nRetries = round(durationMs / 1000)
//   - subtract nRetries × 1000 ms
//   - tag the line with `retryStripped: true, retries: <n>, originalDurationMs: <old>`
// Other spans (db.projection.{read,write}, http.request, …) are written unchanged.
//
// Output: logs10-noretry/*.log (same filenames as logs10/).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const IN_DIR = join(HERE, 'logs10')
const OUT_DIR = join(HERE, 'logs10-noretry')
const THRESHOLD_MS = 500       // any event.handle ≥ THRESHOLD is inspected
const RETRY_MS = 1000          // exact sleep length in setTimeout

mkdirSync(OUT_DIR, { recursive: true })

for (const file of readdirSync(IN_DIR).sort()) {
  if (!file.endsWith('.log')) continue
  const inPath = join(IN_DIR, file)
  const outPath = join(OUT_DIR, file)
  const lines = readFileSync(inPath, 'utf-8').split('\n')
  const out = []
  let scanned = 0
  let stripped = 0
  let retriesTotal = 0
  const retryHist = { 1: 0, 2: 0, 3: 0 }

  for (const ln of lines) {
    if (!ln) continue
    let e
    try { e = JSON.parse(ln) } catch { out.push(ln); continue }

    if (e.span !== 'event.handle' || typeof e.durationMs !== 'number') {
      out.push(ln)
      continue
    }
    scanned++

    if (e.durationMs < THRESHOLD_MS) {
      out.push(ln)
      continue
    }

    // Compute retry count. round() handles slight drift around exact 1000ms
    // boundaries (we observe 1003–1009 ms per retry due to scheduling jitter).
    const nRetries = Math.max(1, Math.min(3, Math.round(e.durationMs / RETRY_MS)))
    const original = e.durationMs
    const corrected = original - nRetries * RETRY_MS
    if (corrected < 0) {
      // Sanity guard — keep the line, but skip stripping.
      out.push(ln)
      continue
    }
    stripped++
    retriesTotal += nRetries
    retryHist[nRetries] = (retryHist[nRetries] || 0) + 1
    const fixed = {
      ...e,
      durationMs: corrected,
      retryStripped: true,
      retries: nRetries,
      originalDurationMs: original,
    }
    out.push(JSON.stringify(fixed))
  }

  writeFileSync(outPath, out.join('\n') + (out.length ? '\n' : ''))
  console.log(
    `${file}: event.handle scanned=${scanned}  stripped=${stripped} ` +
    `(retries: 1×${retryHist[1] || 0}, 2×${retryHist[2] || 0}, 3×${retryHist[3] || 0}, ` +
    `total subtracted = ${retriesTotal * RETRY_MS} ms)`
  )
}
