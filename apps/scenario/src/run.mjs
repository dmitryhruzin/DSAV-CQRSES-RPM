#!/usr/bin/env node
//
// Scenario runner with two modes.
//
// MODE=sequential (default)
//   Runs the full 41-step business flow N times back-to-back. Each iteration
//   creates fresh aggregates. Use for collecting clean per-step samples for
//   QN-model averaging.
//
// MODE=load
//   First runs the scenario once to bootstrap a pool of aggregates, then fires
//   three INDEPENDENT concurrent loops at target rates: GETs, POSTs, PATCHes.
//   Inter-arrival times are exponentially distributed (Poisson process).
//
// Server logs everything (telemetry + req.id). This script just triggers
// HTTP requests and prints high-level progress.
//
// Env:
//   BASE_URL      target API (default http://localhost:8000)
//   MODE          'sequential' (default) | 'load'
//   ITERATIONS    sequential: how many times to run the scenario (default 1)
//   DELAY_MS      sequential: pause between calls (default 100)
//   READ_DELAY    sequential: pause before READS phase (default 200)
//   DURATION_S    load: how long to drive load (default 60s)
//   RPS_GET       load: target reads/s (default 39.17)
//   RPS_POST      load: target creates/s (default 0.282)
//   RPS_PATCH     load: target updates/s (default 2.538)
//   VERBOSE       set 1 to force per-step output even when ITERATIONS > 1
//   OUT_DIR       where to write per-run latency files (default: ./output next to this script)

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const MODE = process.env.MODE ?? 'sequential'
const ITERATIONS = Number(process.env.ITERATIONS ?? 1)
const DELAY_MS = Number(process.env.DELAY_MS ?? 100)
const READ_DELAY = Number(process.env.READ_DELAY ?? 200)
const DURATION_S = Number(process.env.DURATION_S ?? 60)
const RPS_GET = Number(process.env.RPS_GET ?? 100) // 39.17
const RPS_POST = Number(process.env.RPS_POST ?? 50) // 0.282
const RPS_PATCH = Number(process.env.RPS_PATCH ?? 75) // 2.538
const VERBOSE = process.env.VERBOSE === '1' || (MODE === 'sequential' && ITERATIONS === 1)
const OUT_DIR = process.env.OUT_DIR ?? join(__dirname, 'output')

// Run-start timestamp — used both inside output files and to name them.
const RUN_STARTED = new Date()
const RUN_TS = RUN_STARTED.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Exponential inter-arrival sleep for Poisson arrivals at `rate` req/s.
const expSleep = (rate) => sleep((-Math.log(1 - Math.random()) / rate) * 1000)

const pickRand = (arr) => arr[(Math.random() * arr.length) | 0]

const rand = (n = 6) => {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < n; i++) s += c[(Math.random() * c.length) | 0]
  return s
}

const randRegistrationNumber = () => {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const d = '0123456789'
  let s = ''
  for (let i = 0; i < 2; i++) s += c[(Math.random() * c.length) | 0]
  for (let i = 0; i < 4; i++) s += d[(Math.random() * d.length) | 0]
  for (let i = 0; i < 2; i++) s += c[(Math.random() * c.length) | 0]
  return s
}

const randVIN = () => {
  const c = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < 17; i++) s += c[(Math.random() * c.length) | 0]
  return s
}

const randNumber = (n = 6) => {
  let s = ''
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10)
  return s
}

// ─── Latency metrics ──────────────────────────────────────────────────────────
// Response-time samples (ms) collected for every request, kept per-method plus
// an "all" bucket. Summarised at the end of the session (mean/median/p95/p99).
const latencies = { all: [], GET: [], POST: [], PATCH: [] }

// Full per-request records for the raw CSV dump.
let samples = []

const recordLatency = (method, ms, rec) => {
  latencies.all.push(ms)
  if (latencies[method]) latencies[method].push(ms)
  samples.push(rec)
}

// Wipe collected samples (used in load mode to drop the bootstrap phase).
const resetMetrics = () => {
  latencies.all.length = 0
  latencies.GET.length = 0
  latencies.POST.length = 0
  latencies.PATCH.length = 0
  samples = []
}

// Nearest-rank percentile on an unsorted sample array.
const percentile = (sorted, p) => {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

const summarise = (samples) => {
  const n = samples.length
  if (n === 0) return { n: 0, mean: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0 }
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  return {
    n,
    mean,
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[n - 1]
  }
}

// Pretty-print the latency summary for all requests and per method.
const printLatencyStats = () => {
  const fmt = (v) => `${v.toFixed(1)}`.padStart(8)
  const row = (label, s) =>
    `  ${label.padEnd(6)} n=${String(s.n).padStart(6)}  ` +
    `mean=${fmt(s.mean)}  median=${fmt(s.median)}  p95=${fmt(s.p95)}  p99=${fmt(s.p99)}  ` +
    `min=${fmt(s.min)}  max=${fmt(s.max)}`

  console.log('\nResponse-time latency (ms):')
  console.log(row('ALL', summarise(latencies.all)))
  for (const method of ['GET', 'POST', 'PATCH']) {
    if (latencies[method].length > 0) console.log(row(method, summarise(latencies[method])))
  }
}

// Write a raw CSV of every request and a JSON summary. One pair of files per
// run, named by the run-start timestamp so runs never overwrite each other.
const writeOutputFiles = (meta) => {
  if (samples.length === 0) return
  mkdirSync(OUT_DIR, { recursive: true })

  const csvPath = join(OUT_DIR, `latency-${RUN_TS}.csv`)
  const jsonPath = join(OUT_DIR, `summary-${RUN_TS}.json`)

  const header = 'startedAt,method,path,status,ok,ms,reqId'
  const rows = samples.map(
    (s) => `${new Date(s.startedAt).toISOString()},${s.method},${s.path},${s.status},${s.ok ? 1 : 0},${s.ms.toFixed(3)},${s.reqId ?? ''}`
  )
  writeFileSync(csvPath, header + '\n' + rows.join('\n') + '\n')

  const summary = {
    runStartedAt: RUN_STARTED.toISOString(),
    ...meta,
    all: summarise(latencies.all),
    byMethod: {
      GET: summarise(latencies.GET),
      POST: summarise(latencies.POST),
      PATCH: summarise(latencies.PATCH)
    }
  }
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + '\n')

  console.log(`\nWrote:\n  ${csvPath}\n  ${jsonPath}`)
}

// ─── HTTP ───────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const url = `${BASE_URL}${path}`
  const init = { method, headers: { 'content-type': 'application/json' } }
  if (body !== undefined) init.body = JSON.stringify(body)

  const t0 = performance.now()
  const startedAt = Date.now()
  try {
    const res = await fetch(url, init)
    const reqId = res.headers.get('x-request-id')
    const text = await res.text()
    const ms = performance.now() - t0
    recordLatency(method, ms, { startedAt, method, path, status: res.status, ok: res.ok, ms, reqId })
    let response = null
    try {
      response = JSON.parse(text)
    } catch {
      response = text
    }
    return { status: res.status, reqId, response, ok: res.ok, ms }
  } catch (e) {
    const ms = performance.now() - t0
    recordLatency(method, ms, { startedAt, method, path, status: 0, ok: false, ms, reqId: null })
    return { status: 0, reqId: null, response: null, ok: false, error: e.message, ms }
  }
}

// `step` is used by the sequential scenario. In sequential mode it prints
// per-step status; in load-mode bootstrap we silence it.
async function step(label, method, path, body, opts = {}) {
  const r = await api(method, path, body)

  if (VERBOSE && !opts.silent) {
    const tag = r.ok ? '✓' : '✗'
    const aggId =
      r.response && typeof r.response === 'object' && r.response.aggregateId ? r.response.aggregateId.slice(0, 8) : ''
    console.log(
      `${tag} ${label.padEnd(34)}  ${method.padEnd(6)} ${path.padEnd(36)}  ${String(r.status).padStart(3)}  ${(r.ms ?? 0).toFixed(1).padStart(7)}ms  req=${(r.reqId ?? '-').slice(0, 8)}${aggId ? '  agg=' + aggId : ''}`
    )
    if (!r.ok) console.error(`   ↳ error response:`, r.response)
  }

  if (DELAY_MS && !opts.silent) await sleep(DELAY_MS)
  return r.response
}

// ─── Sequential scenario (one iteration of the full 41-step business flow) ──
// Returns a pool of created aggregate IDs so callers (load mode) can use them.
async function runScenario(opts = {}) {
  const silent = opts.silent === true

  // ─── USER ───
  const user = await step('1. user.create', 'POST', '/users/', { password: 'p4ssw0rd-' + rand() }, { silent })
  if (!user?.aggregateId) throw new Error('user.create failed')
  const userId = user.aggregateId

  await step(
    '2. user.change-password',
    'PATCH',
    '/users/change-password',
    { id: userId, newPassword: 'newpass-' + rand() },
    { silent }
  )
  await step('3. user.enter-system', 'PATCH', '/users/enter-system', { id: userId }, { silent })

  // ─── CUSTOMER ───
  const customer = await step(
    '4. customer.create',
    'POST',
    '/customers/',
    {
      userID: userId,
      firstName: 'John',
      lastName: 'Doe',
      email: `john.${rand()}@example.com`,
      phoneNumber: '+1555' + randNumber(7)
    },
    { silent }
  )
  if (!customer?.aggregateId) throw new Error('customer.create failed')
  const customerId = customer.aggregateId

  await step(
    '5. customer.rename',
    'PATCH',
    '/customers/rename',
    { id: customerId, firstName: 'Jonathan', lastName: 'Smith' },
    { silent }
  )
  await step(
    '6. customer.change-contacts',
    'PATCH',
    '/customers/change-contacts',
    {
      id: customerId,
      email: `jonathan.${rand()}@example.com`,
      phoneNumber: '+1555' + randNumber(7)
    },
    { silent }
  )

  // ─── CAR ───
  const car = await step(
    '7. car.create',
    'POST',
    '/cars/',
    {
      ownerID: customerId,
      vin: randVIN(),
      registrationNumber: randRegistrationNumber(),
      mileage: 12000
    },
    { silent }
  )
  if (!car?.aggregateId) throw new Error('car.create failed')
  const carId = car.aggregateId

  await step('8. car.record-mileage', 'PATCH', '/cars/record-mileage', { id: carId, mileage: 12500 }, { silent })

  // ─── WORKER ───
  const worker = await step(
    '9. worker.hire',
    'POST',
    '/workers/',
    { hourlyRate: '50.00', role: 'mechanic' },
    { silent }
  )
  if (!worker?.aggregateId) throw new Error('worker.hire failed')
  const workerId = worker.aggregateId

  await step(
    '10. worker.change-role',
    'PATCH',
    '/workers/change-role',
    { id: workerId, role: 'senior-mechanic' },
    { silent }
  )
  await step(
    '11. worker.change-hourly-rate',
    'PATCH',
    '/workers/change-hourly-rate',
    { id: workerId, hourlyRate: '65.00' },
    { silent }
  )

  // ─── ORDER ───
  const order = await step(
    '12. order.create',
    'POST',
    '/orders/',
    { title: 'Brake service', price: '300.00' },
    { silent }
  )
  if (!order?.aggregateId) throw new Error('order.create failed')
  const orderId = order.aggregateId

  await step(
    '13. order.apply-discount',
    'PATCH',
    '/orders/apply-discount',
    { id: orderId, discount: '10.00' },
    { silent }
  )
  await step('14. order.set-priority', 'PATCH', '/orders/set-priority', { id: orderId, priority: 1 }, { silent })
  await step('15. order.approve', 'PATCH', '/orders/approve', { id: orderId }, { silent })

  // ─── WORK ───
  const work = await step(
    '16. work.create',
    'POST',
    '/work/',
    { title: 'Replace front pads', description: 'Replace worn front brake pads' },
    { silent }
  )
  if (!work?.aggregateId) throw new Error('work.create failed')
  const workId = work.aggregateId

  await step(
    '17. work.change-title',
    'PATCH',
    '/work/change-title',
    { id: workId, title: 'Replace front brake pads' },
    { silent }
  )
  await step(
    '18. work.change-description',
    'PATCH',
    '/work/change-description',
    { id: workId, description: 'Replace front brake pads and inspect rotors' },
    { silent }
  )
  await step('19. work.set-estimate', 'PATCH', '/work/set-estimate', { id: workId, estimate: '2h' }, { silent })
  await step('20. work.add-to-order', 'PATCH', '/work/add-to-order', { id: workId, orderID: orderId }, { silent })
  await step(
    '21. work.assign-to-worker',
    'PATCH',
    '/work/assign-to-worker',
    { id: workId, workerID: workerId },
    { silent }
  )

  // ─── EXECUTION ───
  await step('22. order.start', 'PATCH', '/orders/start', { id: orderId }, { silent })
  await step('23. work.start', 'PATCH', '/work/start', { id: workId }, { silent })
  await step('24. work.pause', 'PATCH', '/work/pause', { id: workId }, { silent })
  await step('25. work.resume', 'PATCH', '/work/resume', { id: workId }, { silent })
  await step('26. work.complete', 'PATCH', '/work/complete', { id: workId }, { silent })
  await step('27. order.complete', 'PATCH', '/orders/complete', { id: orderId }, { silent })

  // ─── WAIT FOR PROJECTIONS ───
  if (READ_DELAY > 0 && !silent) await sleep(READ_DELAY)

  // ─── READS ───
  await step('28. user.get-by-id', 'GET', `/users/${userId}`, undefined, { silent })
  await step('29. user.list', 'GET', '/users/?page=1&pageSize=10', undefined, { silent })
  await step('30. customer.get-by-id', 'GET', `/customers/${customerId}`, undefined, { silent })
  await step('31. customer.list', 'GET', '/customers/?page=1&pageSize=10', undefined, { silent })
  await step('32. customer.with-cars', 'GET', `/customers/${customerId}/with-cars`, undefined, { silent })
  await step('33. car.get-by-id', 'GET', `/cars/${carId}`, undefined, { silent })
  await step('34. car.list', 'GET', '/cars/?page=1&pageSize=10', undefined, { silent })
  await step('35. worker.get-by-id', 'GET', `/workers/${workerId}`, undefined, { silent })
  await step('36. worker.list', 'GET', '/workers/?page=1&pageSize=10', undefined, { silent })
  await step('37. order.get-by-id', 'GET', `/orders/${orderId}`, undefined, { silent })
  await step('38. order.list', 'GET', '/orders/?page=1&pageSize=10', undefined, { silent })
  await step('39. work.get-by-id', 'GET', `/work/${workId}`, undefined, { silent })
  await step('40. work.list', 'GET', '/work/?page=1&pageSize=10', undefined, { silent })

  // ─── FINAL ───
  await step('41. user.exit-system', 'PATCH', '/users/exit-system', { id: userId }, { silent })

  return { userId, customerId, carId, workerId, orderId, workId }
}

// ─── Sequential mode ────────────────────────────────────────────────────────
async function runSequential() {
  console.log(`Sequential mode: ${ITERATIONS} iteration(s) against ${BASE_URL}\n`)
  const t0 = Date.now()
  let ok = 0
  let failed = 0
  for (let i = 1; i <= ITERATIONS; i++) {
    try {
      await runScenario()
      ok++
      if (!VERBOSE) {
        process.stdout.write(`\r  iteration ${i}/${ITERATIONS} done (${ok} ok, ${failed} failed)`)
      }
    } catch (e) {
      failed++
      console.error(`\n✗ iteration ${i} aborted: ${e.message}`)
    }
  }
  const elapsed = (Date.now() - t0) / 1000
  console.log(
    `\n\nDone in ${elapsed.toFixed(1)}s.  ${ok} iterations ok, ${failed} failed.  ${(ok * 41).toLocaleString()} requests sent.`
  )
  printLatencyStats()
  writeOutputFiles({ mode: 'sequential', iterations: ITERATIONS, ok, failed, elapsedS: elapsed })
}

// ─── Load mode ──────────────────────────────────────────────────────────────
// Pool of aggregate IDs that grows as POSTs add to it. GET/PATCH read from it.
// `customersWithCars` is a parallel index of customer IDs that have at least one
// car linked — used by /customers/:id/with-cars which 404s on cars-less customers.
const pool = { user: [], customer: [], car: [], worker: [], order: [], work: [], customersWithCars: [] }

const counters = { GET: 0, POST: 0, PATCH: 0, errors: 0 }

const recordResult = (method, ok) => {
  counters[method]++
  if (!ok) counters.errors++
}

// ── Random GETs ──
const getCalls = [
  (p) => api('GET', `/users/${pickRand(p.user)}`),
  () => api('GET', '/users/?page=1&pageSize=10'),
  (p) => api('GET', `/customers/${pickRand(p.customer)}`),
  () => api('GET', '/customers/?page=1&pageSize=10'),
  (p) =>
    p.customersWithCars.length > 0
      ? api('GET', `/customers/${pickRand(p.customersWithCars)}/with-cars`)
      : api('GET', '/customers/?page=1&pageSize=10'),
  (p) => api('GET', `/cars/${pickRand(p.car)}`),
  () => api('GET', '/cars/?page=1&pageSize=10'),
  (p) => api('GET', `/workers/${pickRand(p.worker)}`),
  () => api('GET', '/workers/?page=1&pageSize=10'),
  (p) => api('GET', `/orders/${pickRand(p.order)}`),
  () => api('GET', '/orders/?page=1&pageSize=10'),
  (p) => api('GET', `/work/${pickRand(p.work)}`),
  () => api('GET', '/work/?page=1&pageSize=10')
]

const fireGet = async () => {
  const fn = pickRand(getCalls)
  const r = await fn(pool)
  recordResult('GET', r.ok)
}

// ── Random POSTs (idempotent: just create new entities of independent types) ──
const postCalls = [
  async () => {
    const r = await api('POST', '/users/', { password: 'p4ssw0rd-' + rand() })
    if (r.ok && r.response?.aggregateId) pool.user.push(r.response.aggregateId)
    return r
  },
  async () => {
    if (pool.user.length === 0) return api('POST', '/users/', { password: 'p4ssw0rd-' + rand() })
    const r = await api('POST', '/customers/', {
      userID: pickRand(pool.user),
      firstName: 'John',
      lastName: 'Doe',
      email: `john.${rand()}@example.com`,
      phoneNumber: '+1555' + randNumber(7)
    })
    if (r.ok && r.response?.aggregateId) pool.customer.push(r.response.aggregateId)
    return r
  },
  async () => {
    if (pool.customer.length === 0) return api('POST', '/users/', { password: 'p4ssw0rd-' + rand() })
    const ownerID = pickRand(pool.customer)
    const r = await api('POST', '/cars/', {
      ownerID,
      vin: randVIN(),
      registrationNumber: randRegistrationNumber(),
      mileage: 12000
    })
    if (r.ok && r.response?.aggregateId) {
      pool.car.push(r.response.aggregateId)
      if (!pool.customersWithCars.includes(ownerID)) pool.customersWithCars.push(ownerID)
    }
    return r
  },
  async () => {
    const r = await api('POST', '/workers/', { hourlyRate: '50.00', role: 'mechanic' })
    if (r.ok && r.response?.aggregateId) pool.worker.push(r.response.aggregateId)
    return r
  },
  async () => {
    const r = await api('POST', '/orders/', { title: 'Order ' + rand(4), price: '300.00' })
    if (r.ok && r.response?.aggregateId) pool.order.push(r.response.aggregateId)
    return r
  },
  async () => {
    const r = await api('POST', '/work/', { title: 'Work ' + rand(4), description: 'Description ' + rand(8) })
    if (r.ok && r.response?.aggregateId) pool.work.push(r.response.aggregateId)
    return r
  }
]

const firePost = async () => {
  const r = await pickRand(postCalls)()
  recordResult('POST', r.ok)
}

// ── Random PATCHes (idempotent updates only — avoids state-machine 4xx errors) ──
const patchCalls = [
  (p) => api('PATCH', '/users/change-password', { id: pickRand(p.user), newPassword: 'newpass-' + rand() }),
  (p) =>
    api('PATCH', '/customers/rename', { id: pickRand(p.customer), firstName: 'Renamed', lastName: 'L-' + rand(4) }),
  (p) =>
    api('PATCH', '/customers/change-contacts', {
      id: pickRand(p.customer),
      email: `renamed.${rand()}@example.com`,
      phoneNumber: '+1555' + randNumber(7)
    }),
  (p) =>
    api('PATCH', '/cars/record-mileage', { id: pickRand(p.car), mileage: 12000 + ((Math.random() * 50000) | 0) }),
  (p) => api('PATCH', '/workers/change-role', { id: pickRand(p.worker), role: 'role-' + rand(4) }),
  (p) =>
    api('PATCH', '/workers/change-hourly-rate', {
      id: pickRand(p.worker),
      hourlyRate: (40 + (Math.random() * 50) | 0) + '.00'
    }),
  (p) => api('PATCH', '/orders/apply-discount', { id: pickRand(p.order), discount: '10.00' }),
  (p) =>
    api('PATCH', '/orders/set-priority', { id: pickRand(p.order), priority: 1 + ((Math.random() * 5) | 0) }),
  (p) => api('PATCH', '/work/change-title', { id: pickRand(p.work), title: 'Title ' + rand(4) }),
  (p) => api('PATCH', '/work/change-description', { id: pickRand(p.work), description: 'Description ' + rand(8) }),
  // Estimate validator regex: /^(?:\d+d(?:\s[1-7]h)?|[1-7]h)$/ — only 1–7 hours allowed
  (p) => api('PATCH', '/work/set-estimate', { id: pickRand(p.work), estimate: 1 + ((Math.random() * 7) | 0) + 'h' })
]

const firePatch = async () => {
  // Skip if pool is empty for the picked target
  for (let attempts = 0; attempts < 5; attempts++) {
    const fn = pickRand(patchCalls)
    try {
      const r = await fn(pool)
      recordResult('PATCH', r.ok)
      return
    } catch {
      // try another
    }
  }
}

// ── Driver loop: open-loop Poisson fire-and-track ──
const driver = async (rate, fire, deadline, inflight) => {
  while (Date.now() < deadline) {
    await expSleep(rate)
    if (Date.now() >= deadline) break
    const p = fire().finally(() => inflight.delete(p))
    inflight.add(p)
  }
}

async function runLoad() {
  console.log(`Load mode against ${BASE_URL}\n`)
  console.log('Bootstrapping pool by running the scenario once (silent)...')
  const bootstrap = await runScenario({ silent: true })
  pool.user.push(bootstrap.userId)
  pool.customer.push(bootstrap.customerId)
  pool.car.push(bootstrap.carId)
  pool.worker.push(bootstrap.workerId)
  pool.order.push(bootstrap.orderId)
  pool.work.push(bootstrap.workId)
  pool.customersWithCars.push(bootstrap.customerId)
  console.log(
    `Pool: User:${pool.user.length} Customer:${pool.customer.length} Car:${pool.car.length} Worker:${pool.worker.length} Order:${pool.order.length} Work:${pool.work.length}`
  )

  // Drop bootstrap latencies so the summary reflects only the load phase.
  resetMetrics()

  console.log(
    `\nLoad: GET=${RPS_GET}/s, POST=${RPS_POST}/s, PATCH=${RPS_PATCH}/s for ${DURATION_S}s ` +
      `(target ≈ ${(RPS_GET + RPS_POST + RPS_PATCH).toFixed(2)} req/s, ` +
      `≈ ${Math.round((RPS_GET + RPS_POST + RPS_PATCH) * DURATION_S)} total)\n`
  )

  const t0 = Date.now()
  const deadline = t0 + DURATION_S * 1000
  const inflight = new Set()

  // Periodic stats
  const reportInterval = setInterval(() => {
    const el = (Date.now() - t0) / 1000
    const r = (n) => (n / el).toFixed(2)
    process.stdout.write(
      `\r[${el.toFixed(0).padStart(3)}s/${DURATION_S}s] ` +
        `GET ${counters.GET} (${r(counters.GET)}/s)  POST ${counters.POST} (${r(counters.POST)}/s)  ` +
        `PATCH ${counters.PATCH} (${r(counters.PATCH)}/s)  errors ${counters.errors}     `
    )
  }, 1000)

  await Promise.all([
    driver(RPS_GET, fireGet, deadline, inflight),
    driver(RPS_POST, firePost, deadline, inflight),
    driver(RPS_PATCH, firePatch, deadline, inflight)
  ])

  // Drain inflight requests
  if (inflight.size > 0) {
    process.stdout.write(`\n  draining ${inflight.size} in-flight requests...`)
    await Promise.all([...inflight])
  }
  clearInterval(reportInterval)

  const elapsed = (Date.now() - t0) / 1000
  console.log(`\n\nDone in ${elapsed.toFixed(1)}s.`)
  console.log(`  GET   ${counters.GET}  (${(counters.GET / elapsed).toFixed(2)}/s, target ${RPS_GET}/s)`)
  console.log(`  POST  ${counters.POST}  (${(counters.POST / elapsed).toFixed(2)}/s, target ${RPS_POST}/s)`)
  console.log(`  PATCH ${counters.PATCH}  (${(counters.PATCH / elapsed).toFixed(2)}/s, target ${RPS_PATCH}/s)`)
  console.log(`  errors ${counters.errors}`)
  console.log(`  pool grew to: User:${pool.user.length} Customer:${pool.customer.length} Car:${pool.car.length} Worker:${pool.worker.length} Order:${pool.order.length} Work:${pool.work.length}`)
  printLatencyStats()
  writeOutputFiles({
    mode: 'load',
    durationS: DURATION_S,
    elapsedS: elapsed,
    targetRps: { GET: RPS_GET, POST: RPS_POST, PATCH: RPS_PATCH },
    counters: { GET: counters.GET, POST: counters.POST, PATCH: counters.PATCH, errors: counters.errors }
  })
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  if (MODE === 'load') {
    await runLoad()
  } else {
    await runSequential()
  }
}

main().catch((e) => {
  console.error('\n✗ Aborted:', e.message)
  process.exit(1)
})
