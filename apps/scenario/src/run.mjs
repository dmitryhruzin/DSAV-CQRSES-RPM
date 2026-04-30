#!/usr/bin/env node
//
// Sequential business-flow scenario runner.
//
// Just sends API calls in order — server logs everything (telemetry + req.id).
// Prints per-step status + req-id so you can correlate with server logs.
//
// Usage:
//   BASE_URL=http://localhost:8000 npm start --workspace @DSAV-CQRSES-RPM/scenario
//   DELAY_MS=50 npm start --workspace @DSAV-CQRSES-RPM/scenario
//
// Env:
//   BASE_URL    target API (default http://localhost:8000)
//   DELAY_MS    pause between calls in ms (default 100 — gives event handlers time to finish)
//   READ_DELAY  pause before READS phase to let projections catch up (default 200ms)
//

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const DELAY_MS = Number(process.env.DELAY_MS ?? 100)
const READ_DELAY = Number(process.env.READ_DELAY ?? 200)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

const reqIds = []

async function api(method, path, body) {
  const url = `${BASE_URL}${path}`
  const init = { method, headers: { 'content-type': 'application/json' } }
  if (body !== undefined) init.body = JSON.stringify(body)

  const res = await fetch(url, init)
  const reqId = res.headers.get('x-request-id')
  const text = await res.text()
  let response = null
  try {
    response = JSON.parse(text)
  } catch {
    response = text
  }
  return { status: res.status, reqId, response, ok: res.ok }
}

async function step(label, method, path, body) {
  const { status, reqId, response, ok } = await api(method, path, body)
  reqIds.push({ label, reqId })

  const tag = ok ? '✓' : '✗'
  const aggId =
    response && typeof response === 'object' && response.aggregateId ? response.aggregateId.slice(0, 8) : ''
  console.log(
    `${tag} ${label.padEnd(34)}  ${method.padEnd(6)} ${path.padEnd(36)}  ${String(status).padStart(3)}  req=${(reqId ?? '-').slice(0, 8)}${aggId ? '  agg=' + aggId : ''}`
  )

  if (!ok) {
    console.error(`   ↳ error response:`, response)
  }
  if (DELAY_MS) await sleep(DELAY_MS)
  return response
}

async function main() {
  console.log(`Scenario target: ${BASE_URL}\n`)

  // ─── USER ────────────────────────────────────────────────────────────
  const user = await step('1. user.create', 'POST', '/users/', { password: 'p4ssw0rd-' + rand() })
  if (!user?.aggregateId) throw new Error('user.create failed')
  const userId = user.aggregateId

  await step('2. user.change-password', 'PATCH', '/users/change-password', {
    id: userId,
    newPassword: 'newpass-' + rand()
  })
  await step('3. user.enter-system', 'PATCH', '/users/enter-system', { id: userId })

  // ─── CUSTOMER ────────────────────────────────────────────────────────
  const customer = await step('4. customer.create', 'POST', '/customers/', {
    userID: userId,
    firstName: 'John',
    lastName: 'Doe',
    email: `john.${rand()}@example.com`,
    phoneNumber: '+1555' + randNumber(7)
  })
  if (!customer?.aggregateId) throw new Error('customer.create failed')
  const customerId = customer.aggregateId

  await step('5. customer.rename', 'PATCH', '/customers/rename', {
    id: customerId,
    firstName: 'Jonathan',
    lastName: 'Smith'
  })
  await step('6. customer.change-contacts', 'PATCH', '/customers/change-contacts', {
    id: customerId,
    email: `jonathan.${rand()}@example.com`,
    phoneNumber: '+1555' + randNumber(7)
  })

  // ─── CAR ─────────────────────────────────────────────────────────────
  const car = await step('7. car.create', 'POST', '/cars/', {
    ownerID: customerId,
    vin: randVIN().toUpperCase(),
    registrationNumber: randRegistrationNumber().toUpperCase(),
    mileage: 12000
  })
  if (!car?.aggregateId) throw new Error('car.create failed')
  const carId = car.aggregateId

  await step('8. car.record-mileage', 'PATCH', '/cars/record-mileage', { id: carId, mileage: 12500 })

  // ─── WORKER ──────────────────────────────────────────────────────────
  const worker = await step('9. worker.hire', 'POST', '/workers/', { hourlyRate: '50.00', role: 'mechanic' })
  if (!worker?.aggregateId) throw new Error('worker.hire failed')
  const workerId = worker.aggregateId

  await step('10. worker.change-role', 'PATCH', '/workers/change-role', { id: workerId, role: 'senior-mechanic' })
  await step('11. worker.change-hourly-rate', 'PATCH', '/workers/change-hourly-rate', {
    id: workerId,
    hourlyRate: '65.00'
  })

  // ─── ORDER ───────────────────────────────────────────────────────────
  const order = await step('12. order.create', 'POST', '/orders/', { title: 'Brake service', price: '300.00' })
  if (!order?.aggregateId) throw new Error('order.create failed')
  const orderId = order.aggregateId

  await step('13. order.apply-discount', 'PATCH', '/orders/apply-discount', { id: orderId, discount: '10.00' })
  await step('14. order.set-priority', 'PATCH', '/orders/set-priority', { id: orderId, priority: 1 })
  await step('15. order.approve', 'PATCH', '/orders/approve', { id: orderId })

  // ─── WORK ────────────────────────────────────────────────────────────
  const work = await step('16. work.create', 'POST', '/work/', {
    title: 'Replace front pads',
    description: 'Replace worn front brake pads'
  })
  if (!work?.aggregateId) throw new Error('work.create failed')
  const workId = work.aggregateId

  await step('17. work.change-title', 'PATCH', '/work/change-title', { id: workId, title: 'Replace front brake pads' })
  await step('18. work.change-description', 'PATCH', '/work/change-description', {
    id: workId,
    description: 'Replace front brake pads and inspect rotors'
  })
  await step('19. work.set-estimate', 'PATCH', '/work/set-estimate', { id: workId, estimate: '2h' })
  await step('20. work.add-to-order', 'PATCH', '/work/add-to-order', { id: workId, orderID: orderId })
  await step('21. work.assign-to-worker', 'PATCH', '/work/assign-to-worker', { id: workId, workerID: workerId })

  // ─── EXECUTION ───────────────────────────────────────────────────────
  await step('22. order.start', 'PATCH', '/orders/start', { id: orderId })
  await step('23. work.start', 'PATCH', '/work/start', { id: workId })
  await step('24. work.pause', 'PATCH', '/work/pause', { id: workId })
  await step('25. work.resume', 'PATCH', '/work/resume', { id: workId })
  await step('26. work.complete', 'PATCH', '/work/complete', { id: workId })
  await step('27. order.complete', 'PATCH', '/orders/complete', { id: orderId })

  // ─── WAIT FOR PROJECTIONS ────────────────────────────────────────────
  if (READ_DELAY > 0) {
    console.log(`\n--- waiting ${READ_DELAY}ms for projections to catch up ---\n`)
    await sleep(READ_DELAY)
  }

  // ─── READS ───────────────────────────────────────────────────────────
  await step('28. user.get-by-id', 'GET', `/users/${userId}`)
  await step('29. user.list', 'GET', '/users/?page=1&pageSize=10')
  await step('30. customer.get-by-id', 'GET', `/customers/${customerId}`)
  await step('31. customer.list', 'GET', '/customers/?page=1&pageSize=10')
  await step('32. customer.with-cars', 'GET', `/customers/${customerId}/with-cars`)
  await step('33. car.get-by-id', 'GET', `/cars/${carId}`)
  await step('34. car.list', 'GET', '/cars/?page=1&pageSize=10')
  await step('35. worker.get-by-id', 'GET', `/workers/${workerId}`)
  await step('36. worker.list', 'GET', '/workers/?page=1&pageSize=10')
  await step('37. order.get-by-id', 'GET', `/orders/${orderId}`)
  await step('38. order.list', 'GET', '/orders/?page=1&pageSize=10')
  await step('39. work.get-by-id', 'GET', `/work/${workId}`)
  await step('40. work.list', 'GET', '/work/?page=1&pageSize=10')

  // ─── FINAL ───────────────────────────────────────────────────────────
  await step('41. user.exit-system', 'PATCH', '/users/exit-system', { id: userId })

  console.log(`\nDone. ${reqIds.length} requests sent. req-ids:`)
  for (const { label, reqId } of reqIds) {
    console.log(`  ${(reqId ?? '-').padEnd(38)} ${label}`)
  }
}

main().catch((e) => {
  console.error('\n✗ Scenario aborted:', e.message)
  process.exit(1)
})
