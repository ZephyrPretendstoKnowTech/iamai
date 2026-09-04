// The signed-in account is in the readiness strip like any active person
// (derive/operator.ts mfaEvidenceOf, derive/sets.ts personAccounts): it signed
// in now, with MFA, to run the scan, so with a passkey it is Ready, whatever
// the directory's stale sign-in, its licence shape or the records' silence say.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { personAccounts, peopleCounts } from './sets.ts'
import { todayView } from './today.ts'
import { readinessStrip } from './readinessStrip.ts'
import { operatorUserId } from './operator.ts'

const MAPPING = { breakGlassUserIds: [] as string[], serviceAccountUserIds: [] as string[] }
/** The fixture with the operator looking like a shared mailbox to the directory: no plans, a mail address, no sign-in on record, no sign-in records of its own. */
const staleOperator = () => {
  const s = fixtureSnapshot()
  const me = operatorUserId(s)!
  const u = s.users.find((x) => x.id === me)!
  u.lastSuccessfulSignIn = null
  u.assignedPlans = []
  u.mail = 'alex@example.com'
  delete s.signInEvidence[me]
  // A second account in the same shape, not the operator: a shared mailbox, not a person.
  const other = s.users.find((x) => x.id === 'u-2')!
  other.lastSuccessfulSignIn = null
  other.assignedPlans = []
  other.mail = 'shared@example.com'
  delete s.signInEvidence['u-2']
  return { s, me }
}

test('the signed-in account is a person and Ready in the strip; the same shape on another account is a shared mailbox', () => {
  const { s, me } = staleOperator()
  const people = personAccounts(s).map((u) => u.id)
  assert.ok(people.includes(me), 'the operator is a person')
  assert.ok(!people.includes('u-2'), 'the other account in the same shape is not')
  const strip = readinessStrip(s, MAPPING, s.asOf)
  assert.ok(strip.tiles.ready.some((p) => p.id === me), `the operator holds a passkey and signed in now: Ready (${JSON.stringify(Object.fromEntries(Object.entries(strip.tiles).map(([k, v]) => [k, v.map((p) => p.id)])))})`)
  assert.ok(!Object.values(strip.tiles).flat().some((p) => p.id === 'u-2'))
  assert.equal(strip.active, peopleCounts(s, s.asOf).active, 'the strip counts the plan\'s active people, the operator among them')
})

test("Today: the operator's row is proven with the evidence \"signed in now\"; the records' own MFA sign-in wins when they hold one", () => {
  const { s, me } = staleOperator()
  const row = todayView(s, s.asOf).rows.find((r) => r.user.id === me)!
  assert.ok(row, 'the operator has a row')
  assert.ok(row.rung === 5 || row.rung === 4, `proven: rung 5 or 4 (${row.rung})`)
  assert.deepEqual(row.evidence, { kind: 'signedInNow' })
  const mailbox = todayView(s, s.asOf).rows.find((r) => r.user.id === 'u-2')!
  assert.ok(mailbox.kind === 'service' && mailbox.rung === null, 'the shared mailbox is listed as an account that is not a person, on no rung')
  const withRecords = fixtureSnapshot()
  const r2 = todayView(withRecords, withRecords.asOf).rows.find((r) => r.user.id === me)!
  assert.equal(r2.evidence.kind, 'mfa', 'MFA evidence in the records stays the evidence')
})
