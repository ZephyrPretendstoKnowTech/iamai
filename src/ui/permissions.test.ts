// The disclosure cannot drift from the consent screen (prompt 34 §1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GRAPH_SCOPES } from '../graph/scopes.ts'
import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import { SCOPE_COPY, SIGN_IN_SCOPES, consentRows } from '../copy/permissions.ts'
import { RECOVERY_AUDIT_LOOKBACK_DAYS, recoveryAuditRequest } from '../graph/collect/laneBCore.ts'
import { EVIDENCE_WINDOW_DAYS } from '../graph/collect/constants.ts'
import { app } from '../content/content.ts'
import { readFileSync } from 'node:fs'
import { CORE_SOURCES } from '../graph/collect/coreSections.ts'

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

// Every scan with sign-in records also pages through 30 days of directory audit
// events, every category (laneB.ts). How's reads table and both AuditLog.Read.All
// rows, How's and the consent row Connect shows, named sign-in records only
// (Phase 2 audit, How and Connect).
test('the directory-audit read is disclosed: a registry row How lists, and both AuditLog.Read.All rows', () => {
  const path = new URL(recoveryAuditRequest('https://graph.microsoft.com/beta', Date.parse('2026-09-22T00:00:00Z')).url).pathname.replace(/^\/beta/, '')
  const row = COLLECTOR_REGISTRY.find((s) => s.endpoint === path)
  assert.ok(row, `no read on How lists ${path}`)
  assert.equal(row.version, 'beta')
  assert.deepEqual(row.scopes, ['AuditLog.Read.All'])
  assert.match(SCOPE_COPY['AuditLog.Read.All'].reads, /directory audit events/i)
  assert.match(consentRows().find((r) => r.scope === 'AuditLog.Read.All')?.reads ?? '', /directory audit events/i)
})

test('the cross-tenant and passkey-detail reads the collectors make beside their main read are named in their rows', () => {
  // The cross-tenant row's endpoint is the one path the lane-0 request is built
  // from; the other two reads are its alsoReads, which the collector reads from
  // (collectors.test.ts holds the requests to them).
  const cross = COLLECTOR_REGISTRY.find((s) => s.configKey === 'crossTenantAccess')
  assert.equal(cross?.endpoint, '/policies/crossTenantAccessPolicy')
  assert.deepEqual(cross?.alsoReads, ['/policies/crossTenantAccessPolicy/default', '/policies/crossTenantAccessPolicy/partners'])
  const methods = COLLECTOR_REGISTRY.find((s) => s.sourceKey === 'authMethods')
  assert.match(methods?.endpoint ?? '', /beta \/users\/\{id\}\/authentication\/fido2Methods/)
})

// A refused read of a core section builds no plan (coreSections.ts: Connect reads
// "finished with gaps · no plan built"). How's "Without it" for Directory.Read.All
// and AuditLog.Read.All described a weaker plan that the product never builds
// (Phase 2 audit, How).
test('each permission’s "Without it" says no plan is built exactly where refusing it leaves a core section unread', () => {
  const core = COLLECTOR_REGISTRY.filter((s) => (CORE_SOURCES as readonly string[]).includes(s.configKey ? `config:${s.configKey}` : (s.sourceKey ?? '')))
  assert.equal(core.length, CORE_SOURCES.length, 'every core section has its registry row')
  for (const [scope, copy] of Object.entries(SCOPE_COPY)) {
    if (SIGN_IN_SCOPES.includes(scope)) continue
    const stopsThePlan = core.some((s) => s.scopes.includes(scope))
    assert.equal(/\bno plan\b/i.test(copy.without), stopsThePlan, `${scope}: "${copy.without}"`)
  }
})

// The directory-audit window was written out as "30 days" in five disclosures
// beside the constant the read uses (laneBCore.ts RECOVERY_AUDIT_LOOKBACK_DAYS);
// changing it would have left every one stale (Phase 2 review). The sentences
// name one window for the sign-in records and the audit events, so the two
// windows must be the same.
test('every directory-audit disclosure states the window the read uses', () => {
  assert.equal(RECOVERY_AUDIT_LOOKBACK_DAYS, EVIDENCE_WINDOW_DAYS, 'the disclosures give sign-in records and audit events one window')
  const days = `${RECOVERY_AUDIT_LOOKBACK_DAYS} days`
  const audit = COLLECTOR_REGISTRY.find((s) => s.name === 'Directory audit events')
  // SECURITY.md wraps its prose, so its sentences and table cells are read whole.
  const security = readFileSync('SECURITY.md', 'utf8').replace(/\s+/g, ' ').split(/(?<=\.) |\|/).filter((s) => /directory audit events/.test(s))
  assert.ok(security.length >= 2, 'SECURITY.md names the directory-audit read in its summary and its permissions table')
  for (const [where, text] of [
    ['AuditLog.Read.All reads', SCOPE_COPY['AuditLog.Read.All'].reads],
    ['AuditLog.Read.All consent row', SCOPE_COPY['AuditLog.Read.All'].consentReads],
    ['registry gate', audit?.gate ?? ''],
    ['How note', app.how.readRows['Directory audit events']?.note ?? ''],
    ...security.map((s) => ['SECURITY.md', s] as const),
  ] as const) {
    assert.ok(text.includes(days), `${where}: ${text}`)
    for (const d of text.match(/\b\d+ days\b/g) ?? []) assert.equal(d, days, `${where}: ${text}`)
  }
})
