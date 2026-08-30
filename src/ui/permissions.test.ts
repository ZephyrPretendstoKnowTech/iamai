// The disclosure cannot drift from the consent screen (prompt 34 §1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GRAPH_SCOPES } from '../graph/scopes.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { SCOPE_COPY, SIGN_IN_SCOPES } from '../copy/permissions.ts'

test('every scope the app requests is explained in the disclosure', () => {
  const missing = GRAPH_SCOPES.filter((s) => SCOPE_COPY[s] === undefined)
  assert.deepEqual(missing, [], 'requested with nothing said about it')
})

test('nothing is explained that the app does not request', () => {
  const extra = Object.keys(SCOPE_COPY).filter((s) => !GRAPH_SCOPES.includes(s))
  assert.deepEqual(extra, [], 'explained but never requested')
})

test('every scope the collectors use is one the app asks for', () => {
  const used = new Set(COLLECTOR_REGISTRY.flatMap((s) => s.scopes))
  const unrequested = [...used].filter((s) => !GRAPH_SCOPES.includes(s))
  assert.deepEqual(unrequested, [], 'a collector spends a scope consent never asked for')
})

test('a scope no collector uses says so rather than implying it is spent', () => {
  const used = new Set(COLLECTOR_REGISTRY.flatMap((s) => s.scopes))
  for (const scope of GRAPH_SCOPES) {
    if (used.has(scope) || SIGN_IN_SCOPES.includes(scope)) continue
    // An unused scope says plainly that nothing calls it, and the disclosure
    // puts it in its own group rather than inside the table of permissions the
    // tool relies on (prompt 39 item 11). The old copy said "planned", which was
    // a promise; the investigation found the planned collector does not need
    // this scope at all (docs/design/application-read-decision.md).
    assert.match(
      SCOPE_COPY[scope].without,
      /^Nothing\./i,
      `${scope}: requested, unused, and the copy does not say so plainly`,
    )
  }
})

test('every explanation says what it reads and what breaks without it', () => {
  for (const [scope, copy] of Object.entries(SCOPE_COPY)) {
    assert.ok(copy.reads.length > 15, `${scope}: what it reads`)
    assert.ok(copy.without.length > 10, `${scope}: what stops working`)
  }
})

test('no write permission is requested', () => {
  for (const scope of GRAPH_SCOPES) {
    assert.doesNotMatch(scope, /Write|ReadWrite/i, `${scope} is not a read scope`)
  }
})
