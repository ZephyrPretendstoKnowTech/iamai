// Today's rows and ledger (derive/today.ts over derive/ladder.ts): every account
// in the directory is one row; an active person carries one rung; not active and
// the accounts that are not people carry none; the ledger's kinds sum to its
// accounts, a kind at zero is left off the line; the Windows-Hello-only person's
// evidence names the one PC and the phone sign-ins.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { bigFixtureSnapshot } from '../testing/bigFixture.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { SHOW_KEYS, showKeyOf, shows, todayView } from './today.ts'
import { KINDS, RUNGS } from './ladder.ts'
import { ledgerText, readinessWord, rungWords, todayEvidenceText } from '../ui/surfaces/todayCells.ts'
import { pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'

test('every account is one row; a rung means an active person; the ledger sums', () => {
  for (const snapshot of [fixtureSnapshot(), bigFixtureSnapshot(), fixture('demo').snapshot]) {
    const v = todayView(snapshot, snapshot.asOf)
    assert.equal(v.rows.length, snapshot.users.length, 'one row per account in the directory')
    assert.equal(new Set(v.rows.map((r) => r.user.id)).size, v.rows.length, 'no account twice')
    const l = v.ledger
    assert.equal(l.accounts, l.active + l.notActive + KINDS.reduce((n, k) => n + l[k], 0), 'the kinds sum to the accounts')
    assert.equal(l.accounts, v.rows.length)
    assert.equal(v.rows.filter((r) => r.rung !== null).length, l.active, 'the active people are the rows with a rung')
    assert.equal(v.rows.filter((r) => r.kind === 'person' && r.rung === null).length, l.notActive)
    for (const k of KINDS) assert.equal(v.rows.filter((r) => r.kind === k).length, l[k], k)
    for (const r of v.rows) {
      if (r.kind !== 'person') assert.equal(r.rung, null, `${r.user.id}: an account that is not a person stands on no rung`)
      if (r.rung !== null) assert.ok(r.viability && r.viability.activity === 'active', `${r.user.id}: a rung means active`)
      if (r.rung === 5 || r.rung === 4) assert.ok(r.evidence.kind === 'mfa' || r.evidence.kind === 'signedInNow', `${r.user.id}: proven means seen`)
      if (r.rung === 3) assert.equal(r.evidence.kind, 'windowsHello')
      assert.ok(readinessWord(r).length > 0 && todayEvidenceText(r).length > 0, `${r.user.id}: words in every cell`)
    }
    for (const rung of RUNGS) assert.equal(v.rows.filter((r) => shows(r, `rung-${rung}`)).length, v.ladder.rungs[rung].length, `clicking rung ${rung} filters to its people`)
    assert.equal(v.rows.filter((r) => shows(r, 'all')).length, v.rows.length)
  }
})

test('the ledger line: every kind that is not zero, in order, and a kind at zero left off', () => {
  const T = pages.today as { ledger: Record<string, string> }
  assert.equal(ledgerText({ accounts: 42, active: 33, notActive: 5, emergency: 2, service: 0, shared: 1, disabled: 1 }), '42 accounts: 33 active people · 5 not active · 2 emergency access · 1 shared device · 1 sign-in disabled')
  assert.equal(ledgerText({ accounts: 1, active: 1, notActive: 0, emergency: 0, service: 0, shared: 0, disabled: 0 }), '1 account: 1 active person')
  assert.equal(fillText(T.ledger.service, { n: 1 }), '1 service account')
  const d = fixture('demo')
  const v = todayView(d.snapshot, d.snapshot.asOf, d.mapping)
  const line = ledgerText(v.ledger)
  assert.ok(line.startsWith(`${v.ledger.accounts} accounts: ${v.ledger.active} active people`), line)
  assert.ok(!/·\s*·|·\s*$/.test(line), 'no empty value on the line')
  const numbers = [...line.matchAll(/(\d+)/g)].map((m) => Number(m[1]))
  assert.equal(numbers[0], numbers.slice(1).reduce((a, b) => a + b, 0), `the kinds on the line sum to the accounts: ${line}`)
})

test('the Windows-Hello-only person: rung 3, the method word Windows Hello, the evidence the one PC and the phone sign-ins', () => {
  const d = fixture('demo')
  const v = todayView(d.snapshot, d.snapshot.asOf, d.mapping)
  const hello = v.rows.find((r) => r.method === 'windowsHello')
  assert.ok(hello, 'the demo has a Windows-Hello-only person')
  assert.equal(hello.rung, 3)
  assert.equal(readinessWord(hello), rungWords(3).title)
  assert.equal(readinessWord(hello), 'Windows Hello only')
  assert.equal(todayEvidenceText(hello), 'Windows Hello on one PC · 2 phone sign-ins in the window')
  const T = pages.today as { evidence: Record<string, string> }
  assert.equal(`${T.evidence.windowsHello} · ${T.evidence.noPhones}`, 'Windows Hello on one PC · no phone sign-ins seen')
})

test('the accounts that are not people read not a person, with their kind and their own evidence', () => {
  const d = fixture('demo')
  const v = todayView(d.snapshot, d.snapshot.asOf, d.mapping)
  const T = pages.today as { notAPerson: string; kinds: Record<string, string> }
  for (const id of d.mapping.breakGlassUserIds) {
    const row = v.rows.find((r) => r.user.id === id)!
    assert.equal(row.kind, 'emergency')
    assert.equal(readinessWord(row), T.notAPerson)
    assert.ok(row.evidence.kind === 'lastSignIn' || row.evidence.kind === 'neverSignedIn')
  }
  const room = v.rows.find((r) => r.user.displayName === 'Boardroom')!
  assert.equal(room.kind, 'shared')
  assert.equal(room.evidence.kind, 'sharedDevice')
  assert.match(todayEvidenceText(room), /licence/)
  assert.equal(T.kinds.shared, 'Shared device')
  // The Show list: every account, the five rungs, the not active, the four kinds, the guests; a hash names one.
  assert.deepEqual([...SHOW_KEYS], ['all', 'rung-5', 'rung-4', 'rung-3', 'rung-2', 'rung-1', 'notActive', 'emergency', 'service', 'shared', 'disabled', 'guests'])
  assert.equal(showKeyOf('rung-3'), 'rung-3')
  assert.equal(showKeyOf('nonsense'), null)
})
