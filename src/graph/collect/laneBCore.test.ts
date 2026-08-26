// Lane B core tests (prompt 02): window cutoff, time budget, memory ceiling,
// coverage labelling incl. insufficient, newest-gap-first resume, and each
// derived table. All I/O is injected — no fetch, no IndexedDB.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, deriveBlockedToday, derivePolicyResults, runLaneB } from './laneBCore.ts'
import type { LaneBDeps } from './laneBCore.ts'
import type { StoredSignIn } from './types.ts'

const NOW = Date.parse('2026-08-26T00:00:00Z')
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString()

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
  assert.match(r.reason ?? '', /retention may be shorter/)
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
  assert.match(r.reason ?? '', /resumed from cache/)
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
