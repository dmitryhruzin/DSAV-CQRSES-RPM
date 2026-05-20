#!/usr/bin/env node
// Take logs from apps/JMT-prediction-manual/logs/ and drop every log line that
// belongs to a request whose http.request.startedAt is within the first 10 s
// after the FIRST http.request in that file. Non-request lines (server boot,
// telemetry without req.id) are kept as-is. Output → apps/JMT-prediction-manual/logs10/.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IN_DIR = join(__dirname, 'logs')
const OUT_DIR = join(__dirname, 'logs10')
const SKIP_MS = 10_000

mkdirSync(OUT_DIR, { recursive: true })

for (const file of readdirSync(IN_DIR).sort()) {
  if (!file.endsWith('.log')) continue
  const inPath = join(IN_DIR, file)
  const outPath = join(OUT_DIR, file)
  const lines = readFileSync(inPath, 'utf-8').split('\n')

  // Pass 1: find anchor = startedAt of first http.request,
  //         and build req.id -> http.request.startedAt map.
  let anchor = Infinity
  const reqStart = new Map()
  for (const ln of lines) {
    if (!ln) continue
    let r
    try { r = JSON.parse(ln) } catch { continue }
    if (r.span === 'http.request' && typeof r.startedAt === 'number') {
      if (r.startedAt < anchor) anchor = r.startedAt
      const rid = r.req?.id
      if (rid && (!reqStart.has(rid) || r.startedAt < reqStart.get(rid))) {
        reqStart.set(rid, r.startedAt)
      }
    }
  }
  const cutoff = anchor + SKIP_MS
  const dropReqs = new Set()
  for (const [rid, st] of reqStart) if (st < cutoff) dropReqs.add(rid)

  // Pass 2: emit lines whose req.id is NOT in dropReqs.
  // Lines without req.id (server boot, telemetry init) are always kept.
  const out = []
  let kept = 0, dropped = 0, nonReq = 0
  for (const ln of lines) {
    if (!ln) continue
    let r
    try { r = JSON.parse(ln) } catch { out.push(ln); continue }
    const rid = r.req?.id
    if (!rid) { out.push(ln); nonReq++; continue }
    if (dropReqs.has(rid)) { dropped++; continue }
    out.push(ln); kept++
  }
  writeFileSync(outPath, out.join('\n') + (out.length ? '\n' : ''))

  console.log(`${file}: anchor=${anchor}  cutoff=${cutoff}  totalReqs=${reqStart.size}  dropReqs=${dropReqs.size}  linesKept=${kept}  linesDropped=${dropped}  nonReqLines=${nonReq}`)
}
