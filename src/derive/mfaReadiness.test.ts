// MFA Readiness's rows and facts (derive/mfaReadiness.ts over derive/ladder.ts
// and derive/facts.ts; prompt 62): every account in the directory is one row;
// an active person is counted in exactly one readiness state; an enabled person
// who is not counted is explained (never signed in, looks retired, new, or
// activity unread); an account that is not a person is listed by kind and
// carries no state; the facts sum to the accounts; the Windows-Hello-only person
// who also signs in from a phone is proven on Windows and Needs a device on the
// phone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { bigFixtureSnapshot } from '../testing/bigFixture.ts'
import { allFixtures, fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { DEFAULT_SHOW, EXPLAINED, GROUP_ORDER, SHOW_KEYS, SUB_GROUP_AT, readinessView, showKeyOf, shows, subGroupsOf } from './mfaReadiness.ts'
import { stepMfaHold } from './stepMfaReadiness.ts'
import { KINDS } from './ladder.ts'
import { READINESS_STATES, isReady } from '../scoring/phishingResistant.ts'
import { deviceChips, methodsCell, nextCell, rowCells, stateTitle, whyLine } from '../ui/surfaces/readinessCells.ts'
import { pages } from '../content/content.ts'

const T = pages.readiness as unknown as { show: Record<string, string>; counted: Record<string, string> }

test('every account is one row; the active people are counted in the states; an uncounted account carries none; the facts sum', () => {
  for (const snapshot of [fixtureSnapshot(), bigFixtureSnapshot(), fixture('demo').snapshot]) {
    const v = readinessView(snapshot, snapshot.asOf)
    assert.equal(v.rows.length, snapshot.users.length, 'one row per account in the directory')
    assert.equal(new Set(v.rows.map((r) => r.user.id)).size, v.rows.length, 'no account twice')
    const f = v.facts
    assert.equal(f.accounts, f.active + f.notActive + KINDS.reduce((n, k) => n + f.kinds[k], 0), 'the parts sum to the accounts')
    assert.equal(f.accounts, v.rows.length)
    assert.equal(v.rows.filter((r) => r.active).length, v.people, 'the active people are the counted rows')
    // Guests are counted with everyone else (owner, 2026-09-19): the page counts the partition's active people.
    assert.equal(v.people, f.active, 'the page counts the active people, guests included')
    assert.equal(v.guests, v.rows.filter((r) => r.active && r.guest).length, 'the counted guests are named beside the people')
    assert.equal(v.rows.filter((r) => r.kind === 'person' && !r.active).length, f.notActive)
    assert.equal(EXPLAINED.reduce((n, e) => n + v.explained[e], 0), f.notActive, 'every uncounted person is explained')
    for (const k of KINDS) assert.equal(v.rows.filter((r) => r.kind === k).length, f.kinds[k], k)
    for (const r of v.rows) {
      if (r.active) {
        assert.ok(r.kind === 'person' && r.state !== null && r.viability && r.viability.activity === 'active', `${r.user.id}: counted means an active person in one state`)
        assert.equal(r.state, r.readiness?.state, `${r.user.id}: the row's state is its readiness`)
        assert.equal(r.explained, null)
        assert.ok(nextCell(r).length > 0, `${r.user.id}: a counted person always has a next step`)
      } else {
        // Not counted, so no state: an emergency account, a service account and a
        // person outside the window are none of them a failed adoption.
        assert.equal(r.state, null, `${r.user.id}: only an active person has a state`)
        assert.equal(nextCell(r), '', `${r.user.id}: nothing is asked of an uncounted account`)
        assert.deepEqual(deviceChips(r).chips, [], `${r.user.id}: no device is judged for an uncounted account`)
        if (r.kind !== 'person') assert.equal(r.readiness, null, `${r.user.id}: an account that is not a person is not scored`)
        if (r.kind === 'person') assert.ok(r.explained !== null, `${r.user.id}: an uncounted person is explained`)
        else assert.equal(r.explained, null)
      }
      const cells = rowCells(r)
      assert.ok(cells[3].length > 0 && methodsCell(r).main.length > 0, `${r.user.id}: words in the state and methods cells`)
    }
    for (const s of READINESS_STATES) assert.equal(v.rows.filter((r) => shows(r, s)).length, v.counts[s], `the ${s} filter shows the people counted in it`)
    assert.equal(v.rows.filter((r) => shows(r, 'notActive')).length, f.notActive)
    assert.equal(v.rows.filter((r) => shows(r, 'all')).length, v.people, 'Everyone is every active person')
    // The seven states partition the active people: the summary's denominator is
    // the partition's, and nobody is counted twice or dropped.
    assert.equal(READINESS_STATES.reduce((n, s) => n + v.counts[s], 0), v.people, 'the states sum to the active people')
    // The partition's states, one set with the Plan's facts: guests are in both.
    assert.deepEqual(v.counts, f.states)
    assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, v.people - v.counts.ready - v.counts.seamless, 'needs action is every active person who is not Ready or Seamless')
    assert.equal(v.rows.filter((r) => shows(r, 'admins')).length, v.admins.active, 'the Admins filter is the admins counted')
    assert.equal(v.rows.filter((r) => r.admin && r.state !== null && isReady(r.state)).length, v.admins.ready)
  }
})

test('the uncounted are explained or listed by kind, each in words, and with the active people they are every account', () => {
  const d = fixture('demo')
  const v = readinessView(d.snapshot, d.snapshot.asOf, d.mapping)
  for (const r of v.rows) {
    if (r.explained) assert.equal(rowCells(r)[3], T.counted[r.explained], `${r.user.id}: the explained population's own words`)
    if (r.kind !== 'person') assert.equal(rowCells(r)[3], T.show[r.kind], `${r.user.id}: the kind's own words`)
  }
  for (const e of EXPLAINED) assert.ok(T.counted[e], `${e} has words`)
  const explained = EXPLAINED.reduce((n, e) => n + v.explained[e], 0)
  const kinds = KINDS.reduce((n, k) => n + v.facts.kinds[k], 0)
  assert.equal(v.people + explained + kinds, v.facts.accounts, 'the active, the explained and the kinds account for everyone')
  assert.ok(v.explained.retired > 0, 'the demo has somebody who looks retired')
  // Each kind is a filter of its own.
  for (const k of KINDS) assert.equal(showKeyOf(k), k)
})

test('the Windows-Hello-only person who also uses a phone: proven on Windows, Needs a device on the phone, and no passkey', () => {
  const d = fixture('demo')
  const v = readinessView(d.snapshot, d.snapshot.asOf, d.mapping)
  const hello = v.rows.find((r) => r.active && JSON.stringify(r.readiness?.methods) === '["windowsHello"]' && r.readiness?.devices.some((x) => x.type === 'phone'))
  assert.ok(hello, 'the demo has a Windows-Hello-only person who signs in from a phone')
  assert.equal(hello.state, 'device')
  assert.equal(rowCells(hello)[3], stateTitle('device'))
  assert.equal(hello.readiness?.hasPasskey, false)
  assert.deepEqual(hello.readiness?.next, { kind: 'addDevice', os: 'iOS', option: 'authenticatorPasskey' })
  assert.deepEqual(deviceChips(hello).chips.map((c) => [c.os, c.tone]), [['Windows', 'seamless'], ['iPhone', 'device']])
  assert.equal(nextCell(hello), 'Add a passkey in Microsoft Authenticator on the iPhone')
  assert.equal(whyLine(hello), 'Confirmed on one device, but the iPhone signs in without it.')
})

test('the accounts that are not people read their kind, and are never counted or asked for anything', () => {
  const d = fixture('demo')
  const v = readinessView(d.snapshot, d.snapshot.asOf, d.mapping)
  for (const id of d.mapping.breakGlassUserIds) {
    const row = v.rows.find((r) => r.user.id === id)!
    assert.equal(row.kind, 'emergency')
    assert.equal(row.active, false, 'never counted')
    assert.equal(row.state, null)
    assert.equal(rowCells(row)[3], T.show.emergency)
    assert.equal(nextCell(row), '')
    assert.deepEqual(deviceChips(row).chips, [], 'no device is judged for an account the page does not count')
  }
  const room = v.rows.find((r) => r.user.displayName === 'Boardroom')!
  assert.equal(room.kind, 'shared')
  assert.equal(room.state, null)
  // The toolbar offers three filters, Needs action first and on by default; the
  // states, the explained, the kinds and the old hashes still resolve.
  assert.deepEqual([...SHOW_KEYS], ['needsAction', 'admins', 'all'])
  assert.equal(DEFAULT_SHOW, 'needsAction')
  for (const k of [...READINESS_STATES, 'lapsing', 'notActive', 'guests', ...KINDS]) assert.equal(showKeyOf(k), k, `${k} resolves`)
  assert.equal(showKeyOf('needsProof'), 'confirm', 'the old Needs proof lands on Confirm it')
  assert.equal(showKeyOf('needsSetup'), 'method', 'the old Needs setup lands on Needs a method')
  assert.equal(showKeyOf('noPasskey'), 'all', 'the retired No passkey filter lands on Everyone')
  assert.equal(showKeyOf('rung-3'), null, 'the rung filters are gone')
  assert.equal(showKeyOf('nonsense'), null)
})

test('lapsing is the Ready people whose readiness ends within seven days, and nobody else', () => {
  let seen = 0
  for (const f of allFixtures()) {
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const soon = new Date(Date.parse(f.snapshot.asOf) + 7 * 86_400_000).toISOString()
    const expected = v.rows.filter((r) => r.state !== null && isReady(r.state) && r.readiness?.readyUntil != null && r.readiness.readyUntil <= soon).map((r) => r.user.id)
    assert.deepEqual([...v.lapsing].sort(), expected.sort(), `${f.name}: the lapsing list`)
    assert.equal(v.rows.filter((r) => shows(r, 'lapsing', v.lapsing)).length, v.lapsing.length, `${f.name}: the Lapsing filter shows them`)
    for (const r of v.rows) {
      if (r.state !== null && isReady(r.state)) assert.ok(r.readiness?.readyUntil, `${f.name}/${r.user.id}: a Ready person says until when`)
      else assert.equal(r.readiness?.readyUntil ?? null, null, `${f.name}/${r.user.id}: only a Ready person has a Ready-until date`)
    }
    seen += v.lapsing.length
  }
  assert.ok(seen > 0, 'no fixture has anybody lapsing: the premise is untested')
})

// Batch 2 §7 kept: a passkey is a recommendation, never the requirement. A
// Windows-Hello-only person stays in the state the proof gives them.
test('a Windows-Hello-only person keeps their readiness: a passkey is never the requirement', () => {
  let hello = 0
  for (const f of allFixtures()) {
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const r of v.rows) {
      if (!r.active || !r.methods?.includes('windowsHello') || r.methods.includes('passkey')) continue
      assert.notEqual(r.state, 'method', `${f.name}/${r.user.id}: Windows Hello is a phishing-resistant method`)
      assert.ok(r.readiness?.qualifying.includes('windowsHello'), `${f.name}/${r.user.id}: held and usable`)
      if (r.state !== null && isReady(r.state)) {
        assert.equal(shows(r, 'needsAction'), false, `${f.name}/${r.user.id}: a Ready Windows Hello holder is asked for nothing`)
        hello++
      }
    }
  }
  assert.ok(hello > 0, 'no Ready Windows-Hello-only person in the fixtures: the premise is untested')
})

// Batch 2 §7: the counts, the uncounted and a Plan-scoped worklist agree in the
// demo's two snapshots — "Filtered to the N people" is exactly the rows it shows.
test('the demo snapshots: states sum to the summary, the uncounted account for everyone else, and a step-scoped list shows the people it names', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.equal(READINESS_STATES.reduce((n, s) => n + v.counts[s], 0), v.people, `${name}: the states do not sum to the summary`)
    const uncounted = EXPLAINED.reduce((n, e) => n + v.explained[e], 0) + KINDS.reduce((n, k) => n + v.facts.kinds[k], 0)
    assert.equal(v.people + uncounted, v.rows.length, `${name}: the uncounted and the active people are not every account`)
    const r = runFixture(f)
    let scoped = 0
    for (const step of r.steps) {
      const hold = stepMfaHold(step, r.viability ?? [])
      if (!hold?.ids) continue
      const ids = new Set(hold.ids)
      assert.equal(v.rows.filter((row) => ids.has(row.user.id)).length, ids.size, `${name}/${step.id}: the scoped list shows a different number than it names`)
      scoped++
    }
    assert.ok(scoped > 0, `${name}: no step scopes the worklist: the premise is untested`)
  }
})

test('the worklist groups by state in the worklist order, admins lead each sub-grouped group, and every row is in one sub-group', () => {
  assert.deepEqual([...GROUP_ORDER], ['blocked', 'method', 'confirm', 'device', 'unknown', 'ready', 'seamless'])
  const f = fixture('large')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const actionGroups = GROUP_ORDER.filter((s) => !isReady(s) && v.counts[s] > 0)
  assert.ok(actionGroups.length <= 6, `the large worklist has ${actionGroups.length} action groups`)
  let split = 0
  for (const s of GROUP_ORDER) {
    const rows = v.rows.filter((r) => r.state === s)
    if (rows.length <= SUB_GROUP_AT) continue
    split++
    for (const by of ['devices', 'department'] as const) {
      const subs = subGroupsOf(rows, by)
      const ids = subs.flatMap((g) => g.rows.map((r) => r.user.id))
      assert.equal(ids.length, rows.length, `${s}/${by}: every row once`)
      assert.equal(new Set(ids).size, ids.length, `${s}/${by}: no row twice`)
      if (rows.some((r) => r.admin)) {
        assert.equal(subs[0].admins, true, `${s}/${by}: the admins lead`)
        assert.ok(subs[0].rows.every((r) => r.admin))
        assert.ok(subs.slice(1).every((g) => !g.admins && g.rows.every((r) => !r.admin)))
      }
      for (let i = 2; i < subs.length; i++) assert.ok(subs[i - 1].rows.length >= subs[i].rows.length, `${s}/${by}: largest first after the admins`)
    }
  }
  assert.ok(split > 0, 'the large fixture has a group above the sub-group size: the premise is untested')
})
