// The feedback message carries no identifiers (prompt 34 §2).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './roadmap/fixtures/index.ts'
import { diagnosticsSummary, feedbackBody, mailtoHref, FEEDBACK_ADDRESS } from './feedback.ts'

const CTX = { page: '#/roadmap', version: '0.0.1', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140' }

test('the summary is counts only: no names, no sign-in names, no ids', () => {
  const f = fixture('small')
  const body = feedbackBody(CTX, diagnosticsSummary(f.snapshot))
  // Every display name and sign-in name in the tenant.
  for (const u of f.snapshot.users) {
    if (u.displayName) assert.ok(!body.includes(u.displayName), `leaks the name ${u.displayName}`)
    if (u.userPrincipalName) assert.ok(!body.includes(u.userPrincipalName), 'leaks a sign-in name')
    assert.ok(!body.includes(u.id), 'leaks a user id')
  }
  assert.ok(!body.includes(f.snapshot.tenantId), 'leaks the tenant id')
  assert.doesNotMatch(body, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'leaks a GUID')
  assert.doesNotMatch(body, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'leaks an address')
})

test('the summary still says something worth having', () => {
  const summary = diagnosticsSummary(fixture('small').snapshot)
  assert.ok(summary.some((l) => /Users in the directory: \d+/.test(l)))
  assert.ok(summary.some((l) => /Conditional Access policies: \d+/.test(l)))
  assert.ok(summary.some((l) => /Sections that could not be read/.test(l)))
})

test('with no scan, it says so rather than inventing numbers', () => {
  assert.deepEqual(diagnosticsSummary(null), ['No scan on this device.'])
})

test('the body without the summary carries only the page, version and browser', () => {
  const body = feedbackBody(CTX, null)
  assert.match(body, /Page: #\/roadmap/)
  assert.match(body, /Version: 0\.0\.1/)
  assert.match(body, /Browser: Mozilla/)
  assert.doesNotMatch(body, /Users in the directory/)
})

test('the mailto is addressed and prefilled, and nothing is sent by the app', () => {
  const href = mailtoHref(CTX, null)
  assert.ok(href.startsWith(`mailto:${FEEDBACK_ADDRESS}?`))
  assert.match(href, /subject=IAMAI%20feedback/)
  assert.match(href, /body=/)
})
