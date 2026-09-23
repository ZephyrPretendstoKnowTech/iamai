// The disclosure cannot drift from the consent screen (prompt 34 §1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GRAPH_SCOPES } from '../graph/scopes.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { SCOPE_COPY, SIGN_IN_SCOPES } from '../copy/permissions.ts'
import { RECOVERY_AUDIT_LOOKBACK_DAYS, recoveryAuditRequest } from '../graph/collect/laneBCore.ts'

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

test('Application.Read.All is not requested (prompt 46 item 23)', () => {
  assert.equal(GRAPH_SCOPES.includes('Application.Read.All'), false)
  assert.equal('Application.Read.All' in SCOPE_COPY, false)
  // Every requested tenant scope now has a collector behind it.
  const used = new Set(COLLECTOR_REGISTRY.flatMap((s) => s.scopes))
  for (const scope of GRAPH_SCOPES) if (!SIGN_IN_SCOPES.includes(scope)) assert.ok(used.has(scope), `${scope} is requested and spent`)
})

// The canonical requested set, written down once so that adding a scope is a
// deliberate act with a visible diff rather than a quiet widening of consent.
// Every disclosure on the public surfaces is generated from this list, and
// src/graph/msal.test.ts holds MSAL's own token requests to it.
test('the requested scope set includes the dedicated read-only method-policy permission', () => {
  assert.deepEqual(GRAPH_SCOPES, [
    'Policy.Read.All',
    'Policy.Read.AuthenticationMethod',
    'Directory.Read.All',
    'AuditLog.Read.All',
    'RoleManagement.Read.Directory',
    'UserAuthenticationMethod.Read.All',
    'Reports.Read.All',
    'openid',
    'profile',
    'offline_access',
  ])
})

// Phase 2 audit (F8): AuditLog.Read.All pays for two reads, the sign-in records
// and 30 days of the directory audit log (graph/collect/laneB.ts, for the
// automatic recovery checks), and the disclosure named the sign-in records
// alone: on Connect's consent rows, in How's table and in the collector
// registry the "Used for" line and How's reads are generated from.
test('what AuditLog.Read.All reads names the directory audit log beside the sign-in records, for the window the scan reads', () => {
  const { url } = recoveryAuditRequest('https://graph.microsoft.com/beta', Date.parse('2026-09-23T00:00:00Z'))
  assert.match(url, /\/auditLogs\/directoryAudits\?/, 'the premise: the scan reads the directory audit log')
  const copy = SCOPE_COPY['AuditLog.Read.All']
  for (const said of [copy.reads, copy.consentReads ?? '']) {
    assert.match(said, /sign-in records/i, said)
    assert.match(said, /directory audit log/i, `${said} — the directory audit read goes unsaid`)
    assert.match(said, new RegExp(`last ${RECOVERY_AUDIT_LOOKBACK_DAYS} days`), said)
  }
  const audit = COLLECTOR_REGISTRY.find((s) => s.endpoint === '/auditLogs/directoryAudits')
  assert.ok(audit, 'the registry How and the "Used for" line are generated from lists the directory audit read')
  assert.deepEqual(audit.scopes, ['AuditLog.Read.All'])
  assert.equal(audit.lane, 'B', 'it runs with the sign-in records')
})
