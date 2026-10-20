import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import { closePool } from '../src/config/database.js'

describe('API Foundation & Global Middleware', () => {
  let server
  let baseUrl

  before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    const port = server.address().port
    baseUrl = `http://127.0.0.1:${port}`
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    await closePool()
  })

  it('GET /api/health returns 200 OK with health status and security headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    assert.equal(res.status, 200)

    const body = await res.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.message, 'IdentArchive API is running')
    assert.ok(body.database, 'body.database should be defined')
    assert.equal(typeof body.database.connected, 'boolean')

    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(res.headers.get('x-frame-options'))
  })

  it('GET /api/health allows requests from configured CORS origin', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true')
  })

  it('Rejects requests from disallowed CORS origins with 403', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://malicious-site.example' },
    })

    assert.equal(res.status, 403)
    const body = await res.json()
    assert.equal(body.success, false)
    assert.equal(body.error?.code, 'CORS_FORBIDDEN')
  })

  it('GET /api/nonexistent-route returns 404 with structured JSON', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route`)
    assert.equal(res.status, 404)

    const body = await res.json()
    assert.equal(body.success, false)
    assert.equal(body.error?.code, 'NOT_FOUND')
    assert.match(body.error?.message, /not found/)
  })

  it('POST with malformed JSON body returns 400 with structured JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid_json: true',
    })

    assert.equal(res.status, 400)
    const body = await res.json()
    assert.equal(body.success, false)
    assert.equal(body.error?.code, 'BAD_REQUEST')
    assert.equal(body.error?.message, 'Malformed JSON payload')
  })

  it('POST with payload exceeding 1MB returns 413 with structured JSON', async () => {
    const largeData = JSON.stringify({ data: 'x'.repeat(1024 * 1024 + 50) })
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeData,
    })

    assert.equal(res.status, 413)
    const body = await res.json()
    assert.equal(body.success, false)
    assert.equal(body.error?.code, 'PAYLOAD_TOO_LARGE')
  })
})
