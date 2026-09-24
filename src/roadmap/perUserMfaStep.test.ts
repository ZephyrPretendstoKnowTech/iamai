// Finish Moving Off Per-User MFA (s-prereq-per-user-mfa) is on the plan only
// when it has something to say (v2-research/peruser.md): an account the scan
// read as Enabled or Enforced, or a reading that is not whole. A clean read —
// the Users read ok, every account's state read, none Enabled or Enforced —
// builds no step. Unknown is never hidden: an absent reading, one unknown
// account or a partial Users read keeps the step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { perUserMfaReading } from './manualWork.ts'
import type { PerUserMfaReading, TenantSnapshot } from '../graph/collect/types.ts'

const STEP = 's-prereq-per-user-mfa'

/** small, with every account's per-user state read as Disabled, then `edit` applied. */
function withReading(edit: (s: TenantSnapshot) => void = () => {}): Fixture {
  const f = fixture('small')
  const snapshot = structuredClone(f.snapshot)
  snapshot.perUserMfa = Object.fromEntries(snapshot.users.map((u) => [u.id, { state: 'disabled', reason: null } satisfies PerUserMfaReading]))
  edit(snapshot)
  return { ...f, snapshot }
}
const stepOf = (f: Fixture) => runFixture(f).steps.find((s) => s.id === STEP)

test('a clean read builds no per-user MFA step', () => {
  const f = withReading()
  assert.equal(f.snapshot.sources.users?.status, 'ok', 'the premise: the Users read is whole')
  assert.deepEqual(perUserMfaReading(f.snapshot), { enabled: [], unknown: [], clean: true })
  assert.equal(stepOf(f), undefined)
})

test('one account Enforced: the step is built and names it', () => {
  let who = ''
  const f = withReading((s) => {
    const u = s.users.find((x) => x.accountEnabled !== false && x.displayName)!
    who = u.id
    s.perUserMfa![u.id] = { state: 'enforced', reason: null }
  })
  assert.equal(perUserMfaReading(f.snapshot).clean, false)
  const step = stepOf(f)
  assert.ok(step, 'the step is on the plan')
  assert.deepEqual(step.population.ids, [who], 'its accounts are the one read as Enforced')
  const name = f.snapshot.users.find((u) => u.id === who)!.displayName!
  assert.ok(step.configurationFindings?.some((x) => x.key === 'per-user-mfa' && x.detail.includes(name)), `the finding names ${name}`)
})

test('unknown is never hidden: one unread account, no reading at all, or a partial Users read keeps the step', () => {
  const f = withReading((s) => { s.perUserMfa![s.users[0].id] = { state: 'unknown', reason: 'HTTP 429' } })
  assert.deepEqual(perUserMfaReading(f.snapshot).unknown.map((u) => u.id), [f.snapshot.users[0].id])
  assert.ok(stepOf(f), 'unknown is never hidden')

  // No per-user reading at all keeps the step.
  {
    const f = withReading((s) => { delete s.perUserMfa })
    assert.equal(perUserMfaReading(f.snapshot).clean, false)
    assert.ok(stepOf(f))
    assert.ok(stepOf(fixture('small')), 'the fixtures carry no reading, so their plans keep the step')
  }

  // A partial Users read keeps the step, every state read Disabled or not.
  {
    const f = withReading((s) => { s.sources.users = { ...s.sources.users!, status: 'partial', reason: 'signInActivity unavailable' } })
    assert.equal(perUserMfaReading(f.snapshot).clean, false)
    assert.ok(stepOf(f))
  }
})
