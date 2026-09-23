// Lane B core tests (prompt 02): window cutoff, time budget, memory ceiling,
// coverage labelling incl. insufficient, newest-gap-first resume, and each
// derived table. All I/O is injected — no fetch, no IndexedDB.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, deriveAggregates, deriveBlockedToday, derivePolicyResults, deriveReportOnlyPolicyIds, deriveUsageSignals, mapRecoveryAudit, mapRow, recoveryAuditRequest, runLaneB } from './laneBCore.ts'
import { deriveScenarioEvidence } from '../../derive/evidence.ts'
import type { LaneBDeps } from './laneBCore.ts'
import type { StoredSignIn } from './types.ts'

const NOW = Date.parse('2026-08-26T00:00:00Z')
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString()

test('recovery directory-audit projection keeps stable mutation identity and targets', () => {
  assert.deepEqual(mapRecoveryAudit({ id: 'audit-1', activityDateTime: iso(1), activityDisplayName: 'Update group', category: 'GroupManagement', result: 'success', targetResources: [{ id: 'group-1', type: 'Group', displayName: 'Private name' }] }), { id: 'audit-1', at: iso(1), activity: 'Update group', category: 'GroupManagement', result: 'success', targets: [{ id: 'group-1', type: 'Group' }] })
  assert.equal(mapRecoveryAudit({ activityDateTime: iso(1) }), null)
})

let seq = 0
function row(over: Partial<StoredSignIn> & { hoursAgo: number }): StoredSignIn {
  const { hoursAgo, ...rest } = over
  return {
    id: rest.id ?? `row-${++seq}`,
    createdDateTime: iso(hoursAgo),
    userId: rest.userId ?? 'user-1',
    status: { errorCode: 0 },
    ...rest,
  }
}

type Page = { value: StoredSignIn[]; next?: boolean }

function deps(pages: Page[], over: Partial<LaneBDeps> = {}): LaneBDeps & { saved: { covered: unknown; rows: StoredSignIn[] }[] } {
  let clockMs = 0
  let i = 0
  const saved: { covered: unknown; rows: StoredSignIn[] }[] = []
  const d: LaneBDeps & { saved: typeof saved } = {
    startUrl: 'page-0',
    windowDays: 30,
    nowMs: NOW,
    clock: () => clockMs,
    fetchPage: (url) => {
      void url
      clockMs += over.budgetMs !== undefined ? 60 : 1
      const page = pages[i] ?? { value: [] }
      i += 1
      return Promise.resolve({
        value: page.value,
        '@odata.nextLink': page.next ? `page-${i}` : null,
      })
    },
    loadCache: () => Promise.resolve(null),
    saveCache: (covered, rows) => {
      saved.push({ covered, rows })
      return Promise.resolve()
    },
    saved,
    ...over,
  }
  return d
}

test('window cutoff: stops when a page reaches past the window start; covered = full window', async () => {
  const d = deps([
    { value: [row({ hoursAgo: 1 }), row({ hoursAgo: 10 })], next: true },
    { value: [row({ hoursAgo: 20 }), row({ hoursAgo: 31 * 24 })], next: true },
  ])
  const r = await runLaneB(d)
  assert.equal(r.status, 'ok')
  assert.equal(r.rows, 3)
  assert.equal(r.covered?.from, iso(30 * 24))
  assert.equal(d.saved.length, 1)
})

test('history exhausted inside the window is ok with a retention note', async () => {
  const r = await runLaneB(deps([{ value: [row({ hoursAgo: 5 })] }]))
  assert.equal(r.status, 'ok')
  assert.match(r.reason ?? '', /or less if the tenant keeps fewer/)
})

test('time budget: stop is labelled and coverage decides partial', async () => {
  const pages = Array.from({ length: 10 }, (_, n) => ({
    value: [row({ hoursAgo: 30 + n })],
    next: true,
  }))
  const r = await runLaneB(deps(pages, { budgetMs: 100 }))
  assert.equal(r.status, 'partial')
  assert.match(r.reason ?? '', /time budget/)
  assert.match(r.reason ?? '', /covers the most recent/)
})

test('no time budget by default: a slow read runs to the end of the 30-day window (owner item 4, 2026-09-19)', async () => {
  // Twenty pages at a minute each: past the old ten-minute budget, and still the whole window.
  const pages = Array.from({ length: 20 }, (_, n) => ({ value: [row({ hoursAgo: 30 * n + 1 })], next: true }))
  pages.push({ value: [row({ hoursAgo: 31 * 24 })], next: false })
  let clockMs = 0
  let i = 0
  const d = deps([], {
    clock: () => clockMs,
    fetchPage: () => {
      clockMs += 60_000
      const page = pages[i++]
      return Promise.resolve({ value: page.value, '@odata.nextLink': page.next ? `page-${i}` : null })
    },
  })
  const r = await runLaneB(d)
  assert.equal(r.status, 'ok')
  assert.equal(i, pages.length, 'every page up to the window start was read')
  assert.equal(r.covered?.from, iso(30 * 24))
  assert.equal(r.rows, 20)
})

test('insufficient: budget stop with under 24 h covered', async () => {
  const pages = Array.from({ length: 10 }, () => ({ value: [row({ hoursAgo: 2 })], next: true }))
  const r = await runLaneB(deps(pages, { budgetMs: 100 }))
  assert.equal(r.status, 'insufficient')
  assert.match(r.reason ?? '', /minimum 24 h/)
})

test('memory ceiling: stop is labelled; nothing overwrites a null cache save rule', async () => {
  const pages = Array.from({ length: 5 }, () => ({
    value: [row({ hoursAgo: 40 }), row({ hoursAgo: 41 })],
    next: true,
  }))
  const r = await runLaneB(deps(pages, { rowCeiling: 3 }))
  assert.equal(r.status, 'partial')
  assert.match(r.reason ?? '', /memory ceiling/)
})

test('resume newest-gap-first: stops at the cached boundary and merges', async () => {
  const cachedRow = row({ id: 'cached-1', hoursAgo: 100, userId: 'user-2' })
  const d = deps(
    [
      // Gap rows newer than the cached covered.to (48 h ago), then one older row
      // that crosses the boundary and stops the fetch.
      { value: [row({ id: 'new-1', hoursAgo: 2 }), row({ id: 'old-1', hoursAgo: 50 })], next: true },
    ],
    {
      loadCache: () =>
        Promise.resolve({
          covered: { from: iso(30 * 24), to: iso(48) },
          rows: [cachedRow],
        }),
    },
  )
  const r = await runLaneB(d)
  assert.equal(r.status, 'ok')
  assert.match(r.reason ?? '', /resumed from the saved records/)
  assert.equal(r.covered?.from, iso(30 * 24))
  // cached row + both fetched rows survive the merge
  assert.equal(r.rows, 3)
  assert.equal(d.saved.length, 1)
  assert.equal(d.saved[0].rows.length, 3)
})

test('derived: per-user aggregate keeps the latest MFA success', () => {
  const perUser = aggregate([
    row({ userId: 'u1', hoursAgo: 10, authenticationRequirement: 'multiFactorAuthentication', mfaDetail: { authMethod: 'Authenticator' } }),
    row({ userId: 'u1', hoursAgo: 5 }),
  ])
  assert.equal(perUser.u1.signInCount, 2)
  assert.equal(perUser.u1.lastMfaSuccess?.method, 'Authenticator')
  assert.equal(perUser.u1.lastSignIn, iso(5))
})

test('derived: per-policy applied results count classes and users', () => {
  const results = derivePolicyResults([
    row({ userId: 'u1', hoursAgo: 1, appliedConditionalAccessPolicies: [{ id: 'p1', displayName: 'Require MFA', result: 'reportOnlyFailure' }] }),
    row({ userId: 'u2', hoursAgo: 2, appliedConditionalAccessPolicies: [{ id: 'p1', result: 'reportOnlyFailure' }, { id: 'p2', result: 'success' }] }),
    row({ userId: 'u1', hoursAgo: 3, appliedConditionalAccessPolicies: [{ id: 'p1', result: 'reportOnlyFailure' }] }),
  ])
  const p1 = results.find((r) => r.policyId === 'p1')
  assert.equal(p1?.displayName, 'Require MFA')
  assert.equal(p1?.counts.reportOnlyFailure, 3)
  assert.deepEqual([...(p1?.affectedUserIds.reportOnlyFailure ?? [])].sort(), ['u1', 'u2'])
  const p2 = results.find((r) => r.policyId === 'p2')
  assert.equal(p2?.counts.enforcedSuccess, 1)
})

test('derived: a policy whose records are only reportOnlyNotApplied is listed as seen in report-only, and counted nowhere', async () => {
  // Microsoft records reportOnlyNotApplied for every sign-in a report-only
  // policy's conditions do not match, and a block policy never records
  // reportOnlySuccess. Block Unsupported Platforms in a tenant whose people sign
  // in from supported platforms has only these, and the collector kept no trace
  // of them: no result entry, so the scan read as holding no report-only record
  // of a policy it had watched in report-only for two weeks.
  const r = await runLaneB(
    deps([
      {
        value: [
          row({ userId: 'u1', hoursAgo: 1, appliedConditionalAccessPolicies: [{ id: 'p1', result: 'notApplied' }, { id: 'p3', result: 'notApplied' }] }),
          row({ userId: 'u1', hoursAgo: 30, appliedConditionalAccessPolicies: [{ id: 'p1', result: 'reportOnlyNotApplied' }, { id: 'p2', result: 'reportOnlySuccess' }] }),
          row({ userId: 'u2', hoursAgo: 60, appliedConditionalAccessPolicies: [{ id: 'p1', result: 'reportOnlyNotApplied' }, { id: 'p3', result: 'success' }] }),
        ],
      },
    ]),
  )
  assert.deepEqual(r.reportOnlyPolicyIds, ['p1', 'p2'], 'the policies with any report-only result in the collected window')
  assert.equal(r.policyResults.some((p) => p.policyId === 'p1'), false, 'no result entry: a policy with none of the counted results is still read as having no records')
  assert.equal(r.policyResults.find((p) => p.policyId === 'p2')?.counts.reportOnlySuccess, 1, 'the counts are unchanged')
  assert.equal(r.policyResults.find((p) => p.policyId === 'p3')?.counts.enforcedSuccess, 1)
})

test('derived: blocked today uses only the most recent sign-in per user', () => {
  const blocked = deriveBlockedToday([
    // u1 failed earlier but succeeded most recently → not blocked
    row({ userId: 'u1', hoursAgo: 10, conditionalAccessStatus: 'failure', appliedConditionalAccessPolicies: [{ id: 'p1', result: 'failure' }] }),
    row({ userId: 'u1', hoursAgo: 1, conditionalAccessStatus: 'success' }),
    // u2's latest is a failure on p1
    row({ userId: 'u2', hoursAgo: 2, conditionalAccessStatus: 'failure', appliedConditionalAccessPolicies: [{ id: 'p1', displayName: 'Require MFA', result: 'failure' }] }),
  ])
  assert.equal(blocked.length, 1)
  assert.equal(blocked[0].policyId, 'p1')
  assert.deepEqual(blocked[0].userIds, ['u2'])
})

// Prompt 47 item 6: the risk verdicts ride along with the sign-in, and the
// usage signals count the people a risk policy would touch.
test('risk: the higher verdict decides the level; hidden and unknown remain outside known-risk counts', () => {
  const rows = [
    { id: 'a', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u1', riskLevelDuringSignIn: 'high', riskLevelAggregated: 'none' },
    { id: 'b', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u2', riskLevelDuringSignIn: 'none', riskLevelAggregated: 'medium' },
    { id: 'c', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u2', riskLevelDuringSignIn: 'medium', riskLevelAggregated: 'low' },
    { id: 'd', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u3', riskLevelDuringSignIn: 'hidden', riskLevelAggregated: 'hidden' },
    { id: 'e', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u4' },
  ].map((r) => mapRow(r)!)
  assert.equal(rows[0].riskLevelDuringSignIn, 'high')
  assert.equal(rows[4].riskLevelDuringSignIn, undefined)
  const usage = deriveUsageSignals(rows)
  assert.equal(usage.riskHigh.count, 1)
  assert.deepEqual(usage.riskHigh.userIds, ['u1'])
  assert.deepEqual(usage.riskHigh.byDetail, { 'during sign-in': 1 })
  assert.equal(usage.riskMedium.count, 2)
  assert.deepEqual(usage.riskMedium.userIds, ['u2'])
  assert.deepEqual(usage.riskMedium.byDetail, { aggregated: 1, 'during sign-in': 1 })
  assert.equal(usage.legacyAuth.count, 0)
})

// The results no derivation reads. Every sign-in carries one entry per policy
// in the tenant, and these are most of them.
const UNREAD_RESULTS = ['notApplied', 'notEnabled', 'unknownFutureValue', undefined]
const READ_RESULTS = ['success', 'failure', 'reportOnlySuccess', 'reportOnlyFailure', 'reportOnlyInterrupted', 'reportOnlyNotApplied']

test('mapRow keeps only the policy results a derivation reads', () => {
  const raw = {
    id: 'kept-results',
    createdDateTime: iso(1),
    userId: 'u1',
    appliedConditionalAccessPolicies: [...READ_RESULTS, ...UNREAD_RESULTS].map((result, i) => ({ id: `p${i}`, displayName: `Policy ${i}`, ...(result === undefined ? {} : { result }) })),
  }
  assert.deepEqual(mapRow(raw)!.appliedConditionalAccessPolicies!.map((p) => p.result), READ_RESULTS)
  assert.equal(mapRow({ ...raw, appliedConditionalAccessPolicies: 'not a list' })!.appliedConditionalAccessPolicies, null)
  assert.deepEqual(mapRow({ ...raw, appliedConditionalAccessPolicies: [{ id: 'p', result: 'notApplied' }] })!.appliedConditionalAccessPolicies, [])
})

test('dropping the unread policy results changes no derivation', () => {
  const results = [...READ_RESULTS, ...UNREAD_RESULTS]
  const rows: StoredSignIn[] = Array.from({ length: 40 }, (_, i) => ({
    id: `drop-${i}`,
    createdDateTime: iso(Math.floor(i / 2) * 7 + 1),
    userId: `u${i % 7}`,
    status: { errorCode: i % 5 === 0 ? 53003 : 0 },
    conditionalAccessStatus: i % 3 === 0 ? 'failure' : 'success',
    appliedConditionalAccessPolicies: i % 11 === 0 ? null : Array.from({ length: 5 }, (_, k) => ({ id: `p${(i + k) % 6}`, displayName: k % 2 ? `Policy ${(i + k) % 6}` : undefined, result: results[(i * 5 + k) % results.length] })),
  }))
  const unread = new Set<string | undefined>(UNREAD_RESULTS)
  const stripped = rows.map((r) => ({ ...r, appliedConditionalAccessPolicies: r.appliedConditionalAccessPolicies?.filter((p) => !unread.has(p.result)) ?? null }))
  assert.deepStrictEqual(aggregate(stripped), aggregate(rows))
  assert.deepStrictEqual(derivePolicyResults(stripped), derivePolicyResults(rows))
  assert.deepStrictEqual(deriveReportOnlyPolicyIds(stripped), deriveReportOnlyPolicyIds(rows))
  assert.deepStrictEqual(deriveBlockedToday(stripped), deriveBlockedToday(rows))
  assert.deepStrictEqual(deriveUsageSignals(stripped), deriveUsageSignals(rows))
  assert.deepStrictEqual(deriveAggregates(stripped), deriveAggregates(rows))
  assert.deepStrictEqual(deriveScenarioEvidence(stripped), deriveScenarioEvidence(rows))
  assert.ok(deriveBlockedToday(rows).length > 0 && derivePolicyResults(rows).length > 0, 'the rows reach the policy derivations')
})

test('omitted and future device facts stay unreported while explicit false is retained', () => {
  const missing = mapRow({ id: 'device-missing', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u1', deviceDetail: {} })!
  assert.equal(missing.isCompliant, undefined)
  assert.equal(missing.isManaged, undefined)
  assert.equal(missing.trustType, undefined)
  const explicit = mapRow({ id: 'device-explicit', createdDateTime: '2026-08-01T00:00:00Z', userId: 'u1', deviceDetail: { isCompliant: false, isManaged: false, trustType: 'futureTrustValue' } })!
  assert.equal(explicit.isCompliant, false)
  assert.equal(explicit.isManaged, false)
  assert.equal(explicit.trustType, undefined)
})


test('recovery projection preserves the real-shaped target, authentication time and resource tenant', () => {
  const row = mapRow({ id: 'recovery-event', userId: 'account', createdDateTime: '2026-09-16T10:02:00Z', appId: '74658136-14ec-4630-ad9b-26e160ff0fc6', resourceId: '00000003-0000-0000-c000-000000000000', resourceTenantId: 'tenant', status: { errorCode: 0 }, isInteractive: true, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ succeeded: true, authenticationMethod: 'FIDO2 security key', authenticationStepDateTime: '2026-09-16T10:01:00Z', authenticationStepResultDetail: 'Success' }] })!
  const event = aggregate([row]).account.recoveryCandidates![0]
  assert.equal(event.appId, '74658136-14ec-4630-ad9b-26e160ff0fc6')
  assert.equal(event.resourceId, '00000003-0000-0000-c000-000000000000')
  assert.equal(event.authenticationAt, '2026-09-16T10:01:00Z')
  assert.equal(event.resourceTenantId, 'tenant')
  assert.equal(event.freshMethod, true)
})

test('the recovery audit read stays inside Entra directory-audit retention (30 days)', () => {
  const now = Date.parse('2026-09-18T18:00:00.000Z')
  const { since, url } = recoveryAuditRequest('https://graph.microsoft.com/beta', now)
  // Graph refused the old 90-day request: "Minimum allowed time for activityDateTime is 8/18/2026".
  assert.ok(Date.parse(since) >= Date.parse('2026-08-18T00:00:00.000Z'))
  assert.equal(since, '2026-08-19T18:00:00.000Z')
  assert.ok(url.startsWith('https://graph.microsoft.com/beta/auditLogs/directoryAudits?$filter='))
  assert.ok(decodeURIComponent(url).includes(`activityDateTime ge ${since}`))
})
