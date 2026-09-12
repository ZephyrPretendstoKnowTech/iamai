// MFA Readiness's rows and facts (derive/mfaReadiness.ts over derive/ladder.ts
// and derive/facts.ts; Step 7): every account in the directory is one row; an
// active person is counted in exactly one readiness state; an account that is
// not counted carries no state; the facts sum to the accounts; a kind at zero is
// left out of the footer; the Windows-Hello-only person who also signs in from
// a phone is proven on Windows and not on the phone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { bigFixtureSnapshot } from '../testing/bigFixture.ts'
import { allFixtures, fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { COMPAT_SHOW_KEYS, DEFAULT_SHOW, SHOW_KEYS, showKeyOf, shows, readinessView } from './mfaReadiness.ts'
import { stepMfaHold } from './stepMfaReadiness.ts'
import { KINDS } from './ladder.ts'
import { READINESS_STATES } from '../scoring/phishingResistant.ts'
import { actionOf, footerParts, methodsCell, passkeyStripParts, proofLines, readinessWord, stateTitle } from '../ui/surfaces/readinessCells.ts'
import { pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'

test('every account is one row; the active people are counted in the states; an uncounted account carries none; the facts sum', () => {
  for (const snapshot of [fixtureSnapshot(), bigFixtureSnapshot(), fixture('demo').snapshot]) {
    const v = readinessView(snapshot, snapshot.asOf)
    assert.equal(v.rows.length, snapshot.users.length, 'one row per account in the directory')
    assert.equal(new Set(v.rows.map((r) => r.user.id)).size, v.rows.length, 'no account twice')
    const f = v.facts
    assert.equal(f.accounts, f.active + f.notActive + KINDS.reduce((n, k) => n + f.kinds[k], 0), 'the parts sum to the accounts')
    assert.equal(f.accounts, v.rows.length)
    assert.equal(v.rows.filter((r) => r.active).length, f.active, 'the active people are the counted rows')
    assert.equal(v.rows.filter((r) => r.kind === 'person' && !r.active).length, f.notActive)
    for (const k of KINDS) assert.equal(v.rows.filter((r) => r.kind === k).length, f.kinds[k], k)
    for (const r of v.rows) {
      if (r.active) {
        assert.ok(r.kind === 'person' && r.state !== null && r.viability && r.viability.activity === 'active', `${r.user.id}: counted means an active person in one state`)
        assert.equal(r.state, r.readiness?.state, `${r.user.id}: the row's state is its readiness`)
      } else {
        // Not counted, so no state: an emergency account, a service account and a
        // person outside the window are none of them a failed adoption.
        assert.equal(r.state, null, `${r.user.id}: only an active person has a state`)
        assert.equal(actionOf(r), null, `${r.user.id}: nothing is asked of an uncounted account`)
        if (r.kind !== 'person') assert.equal(r.readiness, null, `${r.user.id}: an account that is not a person is not scored`)
      }
      assert.ok(readinessWord(r).length > 0 && methodsCell(r).main.length > 0, `${r.user.id}: words in every cell`)
      if (r.active) assert.ok(proofLines(r).length > 0, `${r.user.id}: a counted person always has a proof line`)
    }
    for (const s of READINESS_STATES) assert.equal(v.rows.filter((r) => shows(r, s)).length, f.states[s], `the ${s} filter shows the people counted in it`)
    assert.equal(v.rows.filter((r) => shows(r, 'notActive')).length, f.notActive)
    assert.equal(v.rows.filter((r) => shows(r, 'all')).length, f.active, 'All is every active person')
    // The four states partition the active people: the summary's denominator is
    // the partition's, and nobody is counted twice or dropped.
    assert.equal(READINESS_STATES.reduce((n, s) => n + v.counts[s], 0), f.active, 'the states sum to the active people')
    assert.deepEqual(v.counts, f.states)
    assert.equal(v.rows.filter((r) => shows(r, 'needsAction')).length, f.active - v.counts.ready, 'needs action is every active person who is not Ready')
  }
})

test('the footer names every uncounted kind that is not zero, in order, and leaves a kind at zero off', () => {
  const T = pages.readiness as { ledger: Record<string, string> }
  const states = { ready: 0, needsProof: 0, needsSetup: 0, unknown: 0 }
  assert.deepEqual(
    footerParts({ accounts: 42, active: 33, notActive: 5, kinds: { emergency: 2, service: 0, shared: 1, disabled: 1 }, states }).map((p) => p.text),
    ['5 not active', '2 emergency access', '1 shared device', '1 sign-in disabled'],
  )
  assert.deepEqual(footerParts({ accounts: 1, active: 1, notActive: 0, kinds: { emergency: 0, service: 0, shared: 0, disabled: 0 }, states }), [], 'nothing to say when everyone is counted')
  assert.equal(fillText(T.ledger.service, { n: 1 }), '1 service account')
  const d = fixture('demo')
  const v = readinessView(d.snapshot, d.snapshot.asOf, d.mapping)
  const parts = footerParts(v.facts)
  // Each part is a filter of its own, and the parts and the active people are the accounts.
  for (const p of parts) assert.equal(showKeyOf(p.show), p.show)
  const numbers = parts.map((p) => Number(p.text.match(/^(\d+)/)?.[1]))
  assert.ok(numbers.every((n) => n > 0), 'no kind at zero')
  assert.equal(v.facts.active + numbers.reduce((a, b) => a + b, 0), v.facts.accounts, 'the footer and the active people account for everyone')
})

test('the Windows-Hello-only person who also uses a phone: proven on Windows, Needs proof on the phone, and no passkey', () => {
  const d = fixture('demo')
  const v = readinessView(d.snapshot, d.snapshot.asOf, d.mapping)
  const hello = v.rows.find((r) => r.active && JSON.stringify(r.readiness?.methods) === '["windowsHello"]')
  assert.ok(hello, 'the demo has a Windows-Hello-only person')
  assert.equal(hello.state, 'needsProof')
  assert.equal(readinessWord(hello), stateTitle('needsProof'))
  assert.deepEqual(hello.readiness?.missing, ['iOS'])
  assert.deepEqual(proofLines(hello), [{ mark: 'good', text: 'Windows Hello · Windows' }, { mark: 'warn', text: 'iOS' }])
  assert.equal(methodsCell(hello).note, 'No passkey')
  assert.equal(actionOf(hello)?.text, 'Test iOS')
})

test('the accounts that are not people read not a person, with their kind, and are never counted or asked for anything', () => {
  const d = fixture('demo')
  const v = readinessView(d.snapshot, d.snapshot.asOf, d.mapping)
  const T = pages.readiness as { notAPerson: string; kinds: Record<string, string> }
  for (const id of d.mapping.breakGlassUserIds) {
    const row = v.rows.find((r) => r.user.id === id)!
    assert.equal(row.kind, 'emergency')
    assert.equal(row.active, false, 'never counted')
    assert.equal(row.state, null)
    assert.equal(readinessWord(row), T.notAPerson)
    assert.equal(actionOf(row), null)
    assert.deepEqual(proofLines(row), [], 'no proof is claimed for an account the page does not count')
  }
  const room = v.rows.find((r) => r.user.displayName === 'Boardroom')!
  assert.equal(room.kind, 'shared')
  assert.equal(room.state, null)
  assert.equal(T.kinds.shared, 'Shared device')
  // The filters the page offers are the reference's five; the three summary
  // counts and the separate populations are what a count or a link from the
  // footer arrives filtered to, and they still resolve. The rungs are gone.
  assert.deepEqual([...SHOW_KEYS], ['needsAction', 'admins', 'noPasskey', 'ready', 'all'])
  assert.deepEqual([...COMPAT_SHOW_KEYS], ['needsProof', 'needsSetup', 'unknown', 'notActive', 'emergency', 'service', 'shared', 'disabled', 'guests'])
  assert.equal(showKeyOf('rung-3'), null, 'the rung filters are gone')
  assert.equal(showKeyOf('needsProof'), 'needsProof')
  assert.equal(showKeyOf('nonsense'), null)
})

// Batch 2 §7: the passkey strip's numbers add up to its denominator. The demo read
// "4 of 30 have a passkey · Show 25 without" with one person whose methods were
// not read in neither count, and the hostile tenant read "0 of 34 have a passkey ·
// None without" when nobody's methods were read at all.
test('the passkey strip accounts for every active person: with, without, and methods not read', () => {
  for (const f of allFixtures()) {
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const { have, without, unread } = v.passkeys
    assert.equal(have + without + unread, v.facts.active, `${f.name}: the passkey parts do not sum to the active people`)
    assert.equal(v.rows.filter((r) => shows(r, 'noPasskey')).length, without, `${f.name}: "Show ${without} without" filters to a different number of rows`)
  }
  const words = (name: 'demo' | 'demo-week2' | 'hostile'): string => {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const s = passkeyStripParts(v.passkeys)
    return [s.without, ...s.rest].filter((x) => x !== null).join(' · ')
  }
  assert.equal(words('demo'), 'Show 25 without → · 1 unread')
  assert.equal(words('demo-week2'), 'Show 22 without → · 1 unread')
  assert.equal(words('hostile'), '34 unread', 'a tenant with no method read is never "None without"')
  assert.deepEqual(passkeyStripParts({ without: 0, unread: 0 }), { without: null, rest: ['None without'] })
})

// Batch 2 §7: "No passkey" is a rollout fact, never a readiness one. Nobody holding
// a passkey or FIDO2 key carries it; a Windows-Hello-only person does, and stays in
// the readiness state the proof gives them (owner, Step 7: a passkey is recommended).
test('no passkey or FIDO2 holder reads No passkey, and a Windows-Hello-only person keeps their readiness', () => {
  let hello = 0
  for (const f of allFixtures()) {
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const r of v.rows) {
      if (r.kind !== 'person') continue
      const rows = f.snapshot.authMethods[r.user.id]
      const registered = f.snapshot.registrationDetails.find((x) => x.id === r.user.id)?.methodsRegistered ?? []
      const holds = Array.isArray(rows) ? rows.some((m) => m.kind === 'passkey' || m.kind === 'fido2') : registered.some((n) => n.startsWith('passKey') || n === 'fido2SecurityKey')
      if (holds) {
        assert.notEqual(methodsCell(r).note, 'No passkey', `${f.name}/${r.user.id}: a passkey holder reads No passkey`)
        assert.equal(shows(r, 'noPasskey'), false, `${f.name}/${r.user.id}: a passkey holder is in No passkey`)
      }
      if (r.active && r.methods?.includes('windowsHello') && !r.methods.includes('passkey')) {
        assert.equal(methodsCell(r).note, 'No passkey')
        assert.equal(r.state, r.readiness?.state, 'No passkey moved a Windows Hello holder out of their readiness')
        hello++
      }
    }
  }
  assert.ok(hello > 0, 'no Windows-Hello-only person in the fixtures: the premise is untested')
})

// Batch 2 §7: the counts, the footer and a Plan-scoped worklist agree in the demo's
// two snapshots — "Filtered to the N people" is exactly the rows it shows.
test('the demo snapshots: states sum to the summary, the footer accounts for everyone, and a step-scoped list shows the people it names', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.equal(READINESS_STATES.reduce((n, s) => n + v.counts[s], 0), v.facts.active, `${name}: the states do not sum to the summary`)
    const footer = footerParts(v.facts).map((p) => Number(p.text.match(/^(\d+)/)?.[1]))
    assert.equal(v.facts.active + footer.reduce((a, b) => a + b, 0), v.rows.length, `${name}: the footer and the active people are not every account`)
    const r = runFixture(f)
    let scoped = 0
    for (const step of r.steps) {
      const hold = stepMfaHold(step, r.viability ?? [])
      if (!hold?.ids) continue
      const ids = new Set(hold.ids)
      assert.equal(v.rows.filter((row) => ids.has(row.user.id) && shows(row, DEFAULT_SHOW)).length, ids.size, `${name}/${step.id}: the scoped list shows a different number than it names`)
      scoped++
    }
    assert.ok(scoped > 0, `${name}: no step scopes the worklist: the premise is untested`)
  }
})
