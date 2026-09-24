// The streaming sign-in read (signInStream.ts) at scale: a tenant with far more
// sign-ins than the old 50,000-record ceiling gets the whole 30-day window, the
// read holds a bounded number of records whatever the tenant's size, its
// derivations equal a straight fold over every record, and a read that stops,
// or a store that fails, is continued or worked around by the next scan
// without a record counted twice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runLaneB } from './signInStream.ts'
import { signInPageUrl } from './laneB.ts'
import type { EvidenceStore, LaneBDeps } from './signInStream.ts'
import { aggregateFold, aggregatesFold, blockedTodayFold, derivePolicyResults, lastEnforcedOf, mapRow, policyResultsFold, reportOnlyIdsFold, targetedReadCandidates, usageFold } from './laneBCore.ts'
import type { SignInEvidence } from './laneBCore.ts'
import { RECOVERY_CANDIDATES_PER_PERSON, SIGN_IN_PAGE_SIZE } from './constants.ts'
import { SectionDisabledError } from './http.ts'
import { scenarioFold } from '../../derive/evidence.ts'
import { foldAll } from '../../derive/rowFold.ts'
import { discardStore, memoryEvidenceStore } from '../../testing/memoryEvidenceStore.ts'
import { PEOPLE, RUN, fakeGraph, firstIndexAtOrBefore, rowTimeMs, whole } from '../../testing/signInSynth.ts'
import type { StoredSignIn } from './types.ts'

const NOW = Date.parse('2026-09-01T00:00:00Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR
const iso = (ms: number): string => new Date(ms).toISOString()
const windowStartOf = (nowMs: number): string => iso(nowMs - 30 * DAY)

type Fake = { pageUrl: (before: string | null) => string; fetchPage: LaneBDeps['fetchPage'] }
const read = (fake: Fake, store: EvidenceStore, over: Partial<LaneBDeps> = {}): Promise<SignInEvidence> =>
  runLaneB({ pageUrl: fake.pageUrl, windowDays: 30, nowMs: NOW, clock: () => 0, fetchPage: fake.fetchPage, store, signal: new AbortController().signal, ...over })

const DERIVED = ['perUser', 'policyResults', 'reportOnlyPolicyIds', 'blockedToday', 'usage', 'aggregates', 'scenarios'] as const
const derived = (r: Pick<SignInEvidence, (typeof DERIVED)[number]>) => Object.fromEntries(DERIVED.map((k) => [k, r[k]]))

/**
 * The derivations as a straight fold over every record, in the order given: one
 * pass for all but the policy results, which take the last enforced record
 * from a first pass over the same records (derivePolicyResults' own rule).
 */
function straightFold(records: () => Iterable<StoredSignIn>) {
  const perUser = aggregateFold()
  const reportOnly = reportOnlyIdsFold()
  const blocked = blockedTodayFold()
  const usage = usageFold()
  const aggregates = aggregatesFold()
  const scenarios = scenarioFold(null)
  let rows = 0
  for (const row of records()) {
    rows += 1
    for (const fold of [perUser, reportOnly, blocked, usage, aggregates, scenarios]) fold.add(row)
  }
  const last = lastEnforcedOf(records())
  const policyResults = foldAll(policyResultsFold((id) => last.get(id)), records())
  return { rows, derived: { perUser: perUser.finish(), policyResults, reportOnlyPolicyIds: reportOnly.finish(), blockedToday: blocked.finish(), usage: usage.finish(), aggregates: aggregates.finish(), scenarios: scenarios.finish() } }
}

/**
 * Order-free form: arrays sorted, keys sorted. A resumed read folds saved
 * records in the store's order within a second (by id), a fresh one in Graph's;
 * nobody signs in twice in one second in these tenants, so only the order of
 * people in a list can differ.
 */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canonical(x)]))
  return v
}

test('a tenant with 311,040 sign-ins in 30 days gets the whole window, holding at most two pages of records at once', async () => {
  const fake = fakeGraph({ seed: 1, anchorMs: NOW, nowMs: NOW })
  const r = await read(fake, discardStore())
  const windowStart = windowStartOf(NOW)
  assert.equal(r.status, 'ok')
  assert.deepEqual(r.covered, { from: windowStart, to: iso(NOW) })
  assert.equal(r.reason, null)
  assert.equal(r.rows, 311_040, 'every sign-in in the window, six times the old ceiling')
  assert.equal(r.stats?.disorder, 0)
  assert.equal(r.stats?.duplicates, 0)
  assert.ok((r.stats?.maxResidentRows ?? Infinity) <= 2 * SIGN_IN_PAGE_SIZE, `held ${r.stats?.maxResidentRows} records at once`)
  assert.equal(fake.urls.length, Math.floor(311_040 / SIGN_IN_PAGE_SIZE) + 1, 'no page is asked for after the one that reached past the window start')
  const expected = straightFold(() => fake.rowsInWindow(windowStart))
  assert.equal(expected.rows, r.rows)
  assert.deepStrictEqual(derived(r), expected.derived)
})

test('a tenant where every sign-in is a passkey sign-in is read inside a 128 MB heap, keeping a bounded number of recovery candidates', () => {
  const probe = fileURLToPath(new URL('../../testing/laneBHeapProbe.ts', import.meta.url))
  const out = spawnSync(process.execPath, ['--max-old-space-size=128', probe, 'passkey'], { encoding: 'utf8' })
  assert.equal(out.status, 0, out.stderr.slice(-2_000))
  const result = JSON.parse(out.stdout.trim().split('\n').pop() as string) as { status: string; rows: number; people: number; candidates: number; mostPerPerson: number }
  assert.equal(result.status, 'ok')
  assert.equal(result.rows, 311_040)
  assert.ok(result.people > 0 && result.people <= PEOPLE)
  assert.ok(result.candidates <= result.people * RECOVERY_CANDIDATES_PER_PERSON, `${result.candidates} candidates for ${result.people} people`)
  assert.equal(result.mostPerPerson, RECOVERY_CANDIDATES_PER_PERSON, 'the passkey sign-ins are candidates, up to the cap')
})

test('a second scan fetches only the gap, reads the rest from the saved records, and folds each record once', async () => {
  const o = { seed: 3, anchorMs: NOW, spacingS: 390 }
  const now1 = NOW - 6 * HOUR
  const store = memoryEvidenceStore()
  const r1 = await read(fakeGraph({ ...o, nowMs: now1 }), store, { nowMs: now1 })
  assert.equal(r1.status, 'ok')
  assert.deepEqual(store.covered, { from: windowStartOf(now1), to: iso(now1) })

  // Six hours later. Graph now also holds a record older than the saved span's
  // end that arrived late, and sends one saved record with a changed field.
  const gap = firstIndexAtOrBefore(o, now1)
  const lateAt = whole(rowTimeMs(o, gap + 12) + 7_000)
  const late = { id: 'late-arrival', createdDateTime: lateAt, userId: 'late-person', status: { errorCode: 0 }, appId: 'c0ffee00-0000-4000-a000-0000000000aa', appDisplayName: 'Late App' }
  const changed = gap + 7
  const fake = fakeGraph({
    ...o,
    nowMs: NOW,
    insert: [{ at: gap + 12, raw: late }],
    variant: (k, raw) => {
      if (k !== changed) return
      raw.appId = 'c0ffee00-0000-4000-a000-0000000000bb'
      raw.appDisplayName = 'Renamed App'
    },
  })
  assert.equal(store.rows.has(fake.rowsInWindow(windowStartOf(NOW)).next().value!.id), false, 'the newest record is not saved yet')
  const r2 = await read(fake, store)
  assert.equal(r2.status, 'ok')
  assert.match(r2.reason ?? '', /^resumed from the saved records: fetched the gap since /)
  assert.doesNotMatch(r2.reason ?? '', /records (at or )?before/, 'nothing older than the saved records was fetched')
  assert.ok(fake.urls.length <= Math.ceil(gap / SIGN_IN_PAGE_SIZE) + 1, `fetched ${fake.urls.length} pages for a gap of ${gap} records`)
  assert.deepEqual(fake.urls, ['start'], 'the saved span reaches the window start, so nothing older is fetched')
  const expected = straightFold(() => fake.rowsInWindow(windowStartOf(NOW)))
  assert.equal(r2.rows, expected.rows, 'each record once: the late arrival and the saved record Graph sent again included')
  assert.deepStrictEqual(canonical(derived(r2)), canonical(expected.derived))
  assert.equal(r2.scenarios.nonMicrosoftApps.detail['Renamed App'], 1, "the fetched copy wins over the saved one")
  assert.equal(r2.scenarios.nonMicrosoftApps.detail['Late App'], 1)
  assert.deepEqual(store.covered, { from: windowStartOf(NOW), to: iso(NOW) })
  assert.ok([...store.rows.values()].every((row) => row.createdDateTime >= windowStartOf(NOW)), 'nothing older than the window stays saved')
})

test('a read that stops is continued by the next scan from where it stopped, also where Graph accepts only the documented createdDateTime filters, and so is a partial span saved before the streaming read', async () => {
  // a read that stops is continued by the next scan from where it stopped
  {
    const o = { seed: 4, anchorMs: NOW, spacingS: 390 }
    const now1 = NOW - HOUR
    const store = memoryEvidenceStore()
    const r1 = await read(fakeGraph({ ...o, nowMs: now1, failOn: (_url, n) => n > 60 }), store, { nowMs: now1 })
    assert.equal(r1.status, 'partial')
    assert.match(r1.reason ?? '', /^collection interrupted: /)
    const frontier = r1.covered!.from
    // Sixty pages end on the last record of a second: that second was being read, and is not folded.
    const lastRead = firstIndexAtOrBefore(o, now1) + 60 * SIGN_IN_PAGE_SIZE - 1
    assert.equal(lastRead % RUN, RUN - 1)
    assert.equal(r1.rows, 60 * SIGN_IN_PAGE_SIZE - RUN)
    assert.equal(frontier, whole(rowTimeMs(o, lastRead - RUN)), 'the span starts at the last whole second folded')
    assert.deepEqual(store.covered, { from: frontier, to: iso(now1) }, 'the saved span ends where the read stopped')

    const fake = fakeGraph({ ...o, nowMs: NOW })
    const r2 = await read(fake, store)
    assert.equal(r2.status, 'ok')
    assert.match(r2.reason ?? '', /^resumed from the saved records: fetched the gap since .+ and the records at or before .+$/, 'the reason names the older records fetched too')
    assert.equal(fake.urls[0], 'start')
    const older = fake.urls.find((u) => u.startsWith('le:'))
    assert.ok(older, 'the older records are fetched from where the saved span ends')
    const olderFrom = older.slice(3).split('#')[0]
    assert.equal(olderFrom, whole(Date.parse(frontier) + o.spacingS * 1000), "from the last second folded, the one after the span's oldest (whose records were still being read)")
    assert.equal(fake.urls.indexOf(older), 1, 'one page for the gap, then the older records')
    const expected = straightFold(() => fake.rowsInWindow(windowStartOf(NOW)))
    assert.equal(r2.rows, expected.rows, 'the second the first read stopped in is counted once')
    assert.deepStrictEqual(canonical(derived(r2)), canonical(expected.derived))
    assert.deepEqual(store.covered, { from: windowStartOf(NOW), to: iso(NOW) })
  }
  // a read that stops is finished by the next scan when Graph accepts only the documented createdDateTime filters
  {
    const o = { seed: 13, anchorMs: NOW, spacingS: 390 }
    const now1 = NOW - HOUR
    const store = memoryEvidenceStore()
    const r1 = await read(documentedFilters(fakeGraph({ ...o, nowMs: now1, failOn: (_url, n) => n > 60 })), store, { nowMs: now1 })
    assert.equal(r1.status, 'partial')
    assert.equal(r1.reason, 'collection interrupted: The network connection was lost.', 'the page read again is accepted, so the reason is the network failure')
    assert.equal(r1.stats?.reanchors, 2)

    const fake = fakeGraph({ ...o, nowMs: NOW })
    const r2 = await read(documentedFilters(fake), store)
    assert.equal(r2.status, 'ok', r2.reason ?? '')
    assert.match(r2.reason ?? '', /^resumed from the saved records: fetched the gap since .+ and the records at or before .+$/)
    const expected = straightFold(() => fake.rowsInWindow(windowStartOf(NOW)))
    assert.equal(r2.rows, expected.rows)
    assert.deepStrictEqual(canonical(derived(r2)), canonical(expected.derived))
    assert.deepEqual(store.covered, { from: windowStartOf(NOW), to: iso(NOW) })
  }
  // a partial span saved before the streaming read is continued the same way
  {
    // The old read saved a stopped read's records whole, the second it stopped in
    // possibly short of a record: it stopped at a page boundary.
    const o = { seed: 5, anchorMs: NOW, spacingS: 390 }
    const now1 = NOW - 2 * HOUR
    const from = whole(rowTimeMs(o, 9_000))
    const records = [...fakeGraph({ ...o, nowMs: now1 }).rowsInWindow(from)]
    const saved = records.filter((r, i) => !(r.createdDateTime === from && i === records.length - 1))
    const store = memoryEvidenceStore({ meta: { from, to: iso(now1) }, rows: saved })
    const fake = fakeGraph({ ...o, nowMs: NOW })
    const r = await read(fake, store)
    assert.equal(r.status, 'ok')
    const expected = straightFold(() => fake.rowsInWindow(windowStartOf(NOW)))
    assert.equal(r.rows, expected.rows)
    assert.deepStrictEqual(canonical(derived(r)), canonical(expected.derived))
  }
})

/**
 * Graph as its signIn resource documents it: createdDateTime filters with eq,
 * le and ge only, and any other operator is refused. The real page URLs
 * (laneB.ts signInPageUrl) are read, and the pages come from `fake`.
 */
const documentedFilters = (fake: ReturnType<typeof fakeGraph>): Fake => ({
  pageUrl: signInPageUrl,
  fetchPage: async (url) => {
    if (!url.startsWith('https://')) return fake.fetchPage(url) // a nextLink
    const filter = new URL(url).searchParams.get('$filter') ?? ''
    const clause = /createdDateTime (\w+) (\S+)/.exec(filter)
    if (clause && !['eq', 'le', 'ge'].includes(clause[1])) throw new Error(`Invalid filter clause: '${clause[1]}' is not supported on createdDateTime.`)
    return fake.fetchPage(clause ? `${clause[1]}:${clause[2]}` : 'start')
  },
})

test('statuses and reasons: an interrupted read, a time budget and a disabled read say what they said before', async () => {
  const o = { seed: 6, anchorMs: NOW, spacingS: 390 }
  const early = await read(fakeGraph({ ...o, nowMs: NOW, failOn: (_url, n) => n > 2 }), memoryEvidenceStore())
  assert.equal(early.status, 'error', 'under 24 h read')
  assert.equal(early.reason, 'The network connection was lost.')
  const later = await read(fakeGraph({ ...o, nowMs: NOW, failOn: (_url, n) => n > 10 }), memoryEvidenceStore())
  assert.equal(later.status, 'partial')
  assert.equal(later.reason, 'collection interrupted: The network connection was lost.')

  let clock = 0
  const slow = fakeGraph({ ...o, nowMs: NOW })
  const tick: LaneBDeps['fetchPage'] = (url) => {
    clock += 1_000
    return slow.fetchPage(url)
  }
  const budget = await read({ pageUrl: slow.pageUrl, fetchPage: tick }, memoryEvidenceStore(), { clock: () => clock, budgetMs: 5_500 })
  const hours = Math.floor((NOW - Date.parse(budget.covered!.from)) / HOUR)
  assert.equal(budget.status, 'partial')
  assert.equal(budget.reason, `stopped at time budget; covers the most recent ${hours} h of the requested 30 days`)
  clock = 0
  const short = await read({ pageUrl: slow.pageUrl, fetchPage: tick }, memoryEvidenceStore(), { clock: () => clock, budgetMs: 500 })
  assert.equal(short.status, 'insufficient')
  assert.match(short.reason ?? '', /^stopped at time budget with only \d+ h covered \(minimum 24 h\)$/)

  const disabled = await read(fakeGraph({ ...o, nowMs: NOW, failOn: () => new SectionDisabledError('Sign-in logs need Microsoft Entra ID P1 or P2.') }), memoryEvidenceStore())
  assert.equal(disabled.status, 'disabled')
  assert.equal(disabled.reason, 'Sign-in logs need Microsoft Entra ID P1 or P2.')
  assert.equal(disabled.covered, null)
})

test('a store that fails is worked around: saved records that cannot be read are fetched from Graph from the last second folded, and a refused write stops saving while the read completes', async () => {
  // saved records that cannot be read are fetched from Graph instead, from the last second folded
  {
    const o = { seed: 7, anchorMs: NOW, spacingS: 390 }
    const now1 = NOW - HOUR
    const store = memoryEvidenceStore({ failReadAfterBatches: 2 })
    assert.equal((await read(fakeGraph({ ...o, nowMs: now1 }), store, { nowMs: now1 })).status, 'ok')
    const fake = fakeGraph({ ...o, nowMs: NOW })
    const r = await read(fake, store)
    assert.equal(r.status, 'ok')
    assert.equal(r.stats?.readFailed, true)
    assert.match(r.reason ?? '', /^the saved records could not all be read: fetched the gap since .+ and the records at or before .+$/, 'the reason says Graph was read for what the store could not give')
    assert.ok(r.stats!.savedRows >= 2_000, 'two batches were read before the store failed')
    assert.match(fake.urls[1] ?? '', /^le:/, 'Graph is read from where the saved records stopped')
    const expected = straightFold(() => fake.rowsInWindow(windowStartOf(NOW)))
    assert.equal(r.rows, expected.rows)
    assert.deepStrictEqual(canonical(derived(r)), canonical(expected.derived))
  }
  // a store that refuses a write (a full disk) stops saving, and the read still completes
  {
    const o = { seed: 8, anchorMs: NOW, spacingS: 390 }
    const store = memoryEvidenceStore({ refuseFromWrite: 50 })
    const fake = fakeGraph({ ...o, nowMs: NOW })
    const r = await read(fake, store)
    assert.equal(r.status, 'ok')
    const expected = straightFold(() => fake.rowsInWindow(windowStartOf(NOW)))
    assert.deepStrictEqual(derived(r), expected.derived)
    assert.equal(store.counts.writesAfterRefusal, 0, 'nothing is written after the refusal')
    assert.equal(r.stats?.refusedWrites, 1)
    assert.ok(store.covered && store.covered.from > windowStartOf(NOW) && store.covered.to === iso(NOW), 'the saved span stays at the last write that succeeded')
  }
})

test('a record Graph sends twice is folded once, even from further back than the frontier in a sparse tenant, and a newer one is counted as out of order', async () => {
  // a record Graph sends twice is folded once; a record newer than those already folded is counted as out of order
  {
    const o = { seed: 9, anchorMs: NOW, spacingS: 390 }
    const twice = fakeGraph({ ...o, nowMs: NOW, repeatRow: SIGN_IN_PAGE_SIZE - 1 })
    const r = await read(twice, discardStore())
    assert.equal(r.stats?.duplicates, 1)
    assert.deepStrictEqual(derived(r), straightFold(() => twice.rowsInWindow(windowStartOf(NOW))).derived)

    const newer = { id: 'out-of-order', createdDateTime: whole(rowTimeMs(o, 100)), userId: 'late-person', status: { errorCode: 0 } }
    const disordered = fakeGraph({ ...o, nowMs: NOW, insert: [{ at: 3 * SIGN_IN_PAGE_SIZE + 50, raw: newer }] })
    const d = await read(disordered, discardStore())
    assert.equal(d.status, 'ok')
    assert.equal(d.stats?.disorder, 1)
    assert.equal(d.rows, straightFold(() => disordered.rowsInWindow(windowStartOf(NOW))).rows, 'it is still folded')
  }
  // in a sparse tenant, a record sent again from further back than the frontier is still folded once
  {
    // Sign-ins five minutes apart; each page after the first starts with a copy of the previous page's third-last record.
    const records = Array.from({ length: 60 }, (_, i) => ({ id: `sparse-${i}`, createdDateTime: whole(NOW - HOUR - i * 300_000), userId: `person-${i % 7}`, status: { errorCode: 0 } }))
    const size = 10
    const fetchPage: LaneBDeps['fetchPage'] = async (url) => {
      const offset = url === 'start' ? 0 : Number(url)
      const value = [...(offset > 0 ? [records[offset - 3]] : []), ...records.slice(offset, offset + size)]
      return { value, '@odata.nextLink': offset + size < records.length ? String(offset + size) : null }
    }
    const r = await read({ pageUrl: () => 'start', fetchPage }, discardStore())
    assert.equal(r.status, 'ok')
    assert.equal(r.rows, 60)
    assert.equal(r.stats?.duplicates, 5)
    assert.equal(r.stats?.disorder, 0)
    assert.deepStrictEqual(derived(r), straightFold(() => records.map((x) => mapRow(x)!)).derived)
  }
})

test('a person whose only sign-in is in the second the read stopped in is left out, and read on their own (MFA Readiness)', async () => {
  const at = (h: number) => iso(NOW - h * HOUR)
  const rec = (id: string, userId: string, h: number) => ({ id, createdDateTime: at(h), userId, status: { errorCode: 0 } })
  const pages = [
    [rec('a', 'person-a', 1), rec('b', 'person-b', 20)],
    [rec('c', 'person-c', 30), rec('x', 'person-x', 40)],
  ]
  let n = 0
  const fetchPage: LaneBDeps['fetchPage'] = async () => {
    const page = pages[n++]
    if (!page) throw new Error('The network connection was lost.')
    return { value: page, '@odata.nextLink': `page-${n}` }
  }
  const r = await read({ pageUrl: () => 'start', fetchPage }, discardStore())
  assert.equal(r.status, 'partial')
  assert.equal(r.covered?.from, at(30), 'the span ends at the last whole second folded')
  assert.equal(r.perUser['person-x'], undefined, 'the second being read is not folded')
  const users = [{ id: 'person-x', lastSuccessfulSignIn: at(40), accountEnabled: true }, { id: 'person-a', lastSuccessfulSignIn: at(1), accountEnabled: true }]
  const methods = { 'person-x': [{ kind: 'passkey' }], 'person-a': [{ kind: 'passkey' }] }
  assert.deepEqual(targetedReadCandidates(users, methods, r.covered, windowStartOf(NOW)), ['person-x'])

  const whole30 = await read(fakeGraph({ seed: 10, anchorMs: NOW, nowMs: NOW, spacingS: 390 }), discardStore())
  assert.equal(whole30.status, 'ok')
  assert.deepEqual(targetedReadCandidates(users, methods, whole30.covered, windowStartOf(NOW)), [], 'a complete read leaves nobody to read on their own')
})

test('policy results from the stream equal the two-pass derivation, with ties and seconds split across pages', async () => {
  const results = ['success', 'failure', 'reportOnlySuccess', 'reportOnlyFailure', 'reportOnlyInterrupted', 'reportOnlyNotApplied', 'notApplied']
  for (let seed = 1; seed <= 50; seed++) {
    let s = seed
    const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5), ((s >>> 0) % 10_000) / 10_000)
    const rows: Record<string, unknown>[] = []
    let t = NOW - 1000
    while (rows.length < 500) {
      const tie = 1 + Math.floor(rnd() * 6)
      for (let i = 0; i < tie && rows.length < 500; i++) {
        rows.push({
          id: `s${seed}-r${rows.length}`,
          createdDateTime: whole(t),
          userId: `person-${Math.floor(rnd() * 40)}`,
          status: { errorCode: 0 },
          conditionalAccessStatus: 'success',
          appliedConditionalAccessPolicies: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ id: `p${Math.floor(rnd() * 4)}`, result: results[Math.floor(rnd() * results.length)] })),
        })
      }
      t -= 1000 * (1 + Math.floor(rnd() * 3600))
    }
    const pageSize = 7
    const fetchPage: LaneBDeps['fetchPage'] = async (url) => {
      const offset = url === 'start' ? 0 : Number(url)
      return { value: rows.slice(offset, offset + pageSize), '@odata.nextLink': offset + pageSize < rows.length ? String(offset + pageSize) : null }
    }
    const r = await read({ pageUrl: () => 'start', fetchPage }, discardStore())
    const mapped = rows.map(mapRow) as StoredSignIn[]
    assert.equal(r.status, 'ok')
    assert.deepStrictEqual(r.policyResults, derivePolicyResults(mapped), `seed ${seed}`)
    assert.deepStrictEqual(derived(r), straightFold(() => mapped).derived, `seed ${seed}`)
  }
})

test('a failing page is read again from the last whole second folded, a re-read that folds nothing does not reset the count, three failures in a row stop the read, and a cancelled or refused read is never read again', async () => {
  // a page that fails is read again from the last whole second folded, and three failures in a row stop the read
  {
    const o = { seed: 11, anchorMs: NOW, spacingS: 390 }
    const flaky = fakeGraph({ ...o, nowMs: NOW, failOn: (_url, n) => n === 40 || n === 41 })
    const r = await read(flaky, discardStore())
    assert.equal(r.status, 'ok')
    assert.equal(r.stats?.reanchors, 2)
    assert.equal(flaky.urls[39], `start#${39 * SIGN_IN_PAGE_SIZE}`)
    assert.match(flaky.urls[40], /^le:/)
    assert.equal(flaky.urls[41], flaky.urls[40], 'both reads again start from the same second')
    const second = flaky.urls[40].slice(3)
    const last39 = 39 * SIGN_IN_PAGE_SIZE - 1
    assert.equal(second, whole(rowTimeMs(o, last39 - (last39 % RUN) - 1)), 'at or before the last whole second folded')
    assert.deepStrictEqual(derived(r), straightFold(() => flaky.rowsInWindow(windowStartOf(NOW))).derived)

    const down = fakeGraph({ ...o, nowMs: NOW, failOn: (_url, n) => (n >= 40 ? new Error(`failure ${n}`) : null) })
    const stopped = await read(down, discardStore())
    assert.equal(stopped.status, 'partial')
    assert.equal(stopped.reason, 'collection interrupted: failure 42', 'the third failure in a row stops it, with its own message')
    assert.equal(stopped.stats?.reanchors, 2)
  }
  // a page read again that folds no further second does not reset the failures: a second of more than a page with a failing next page stops the read
  {
    // Five seconds of one record, then 450 records in one second, then older ones.
    const T = NOW - 2 * HOUR
    const rec = (id: string, ms: number) => ({ id, createdDateTime: whole(ms), userId: `person-${id}`, status: { errorCode: 0 } })
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => rec(`new-${i}`, T + (5 - i) * 1000)),
      ...Array.from({ length: 450 }, (_, i) => rec(`tie-${i}`, T)),
      ...Array.from({ length: 100 }, (_, i) => rec(`old-${i}`, T - (i + 1) * 60_000)),
    ]
    const cancel = new AbortController()
    const urls: string[] = []
    const fetchPage: LaneBDeps['fetchPage'] = async (url) => {
      urls.push(url)
      // A guard for the read that never ends: the scan is cancelled.
      if (urls.length > 30) {
        cancel.abort()
        throw new DOMException('The scan was cancelled.', 'AbortError')
      }
      const [base, offset] = url.split('#')
      if (offset !== undefined) throw new Error('The network connection was lost.')
      const through = base === 'start' ? Number.POSITIVE_INFINITY : Date.parse(base.slice(3))
      return { value: rows.filter((r) => Date.parse(r.createdDateTime) <= through).slice(0, SIGN_IN_PAGE_SIZE), '@odata.nextLink': `${base}#${SIGN_IN_PAGE_SIZE}` }
    }
    const r = await read({ pageUrl: (through) => (through === null ? 'start' : `le:${through}`), fetchPage }, discardStore(), { signal: cancel.signal })
    const again = `le:${whole(T + 1000)}`
    assert.deepEqual(urls, ['start', 'start#200', again, `${again}#200`, again, `${again}#200`], 'three failures with no second folded between them')
    assert.equal(r.stats?.reanchors, 2)
    assert.equal(r.status, 'error')
    assert.equal(r.reason, 'The network connection was lost.')
    assert.equal(r.covered?.from, whole(T + 1000), 'the last whole second folded')
  }
  // a cancelled scan and a refused read are not read again
  {
    const o = { seed: 12, anchorMs: NOW, spacingS: 390 }
    const cancel = new AbortController()
    const fake = fakeGraph({ ...o, nowMs: NOW })
    const cancelling: LaneBDeps['fetchPage'] = (url) => {
      if (fake.urls.length === 4) {
        cancel.abort()
        return Promise.reject(new DOMException('The scan was cancelled.', 'AbortError'))
      }
      return fake.fetchPage(url)
    }
    const cancelled = await read({ pageUrl: fake.pageUrl, fetchPage: cancelling }, discardStore(), { signal: cancel.signal })
    assert.equal(cancelled.stats?.reanchors, 0)
    assert.equal(cancelled.reason, 'collection interrupted: The scan was cancelled.')
    assert.equal(fake.urls.length, 4)

    const refused = fakeGraph({ ...o, nowMs: NOW, failOn: (_url, n) => (n === 5 ? new SectionDisabledError('Sign-in logs need Microsoft Entra ID P1 or P2.') : null) })
    const disabled = await read(refused, discardStore())
    assert.equal(disabled.status, 'disabled')
    assert.equal(disabled.stats?.reanchors, 0)
    assert.equal(refused.urls.length, 5)
  }
})
