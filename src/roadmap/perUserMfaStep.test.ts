// Finish Moving Off Per-User MFA (s-prereq-per-user-mfa) is on the plan once a
// scan of it reads an account with per-user MFA on, names those accounts, and
// reads Completed — not gone — once every account reads Disabled (walk list 4.x
// items 9, 54 and 55). A plan that never read one has no step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { perUserMfaSeenOnAtOf } from './manualWork.ts'
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

test('per-user MFA: on the plan while an account reads on, Completed once none does, absent where none ever did', () => {
  let who = ''
  const on = withReading((s) => {
    who = s.users.find((x) => x.accountEnabled !== false && x.displayName)!.id
    s.perUserMfa![who] = { state: 'enforced', reason: null }
  })
  const seen = perUserMfaSeenOnAtOf(null, on.snapshot)
  assert.equal(seen, on.snapshot.asOf, 'the scan that reads one on records the day')
  const open = runFixture(on, { perUserMfaSeenOnAt: seen }).steps.find((s) => s.id === STEP)
  assert.ok(open, 'the step is on the plan')
  assert.deepEqual(open.population.ids, [who], 'its accounts are the one read as Enforced')
  assert.notEqual(open.status, 'done')
  assert.equal(open.manualReview, undefined, 'nothing is recorded by hand')

  const off = withReading()
  assert.equal(perUserMfaSeenOnAtOf(seen, off.snapshot), seen, 'a later scan keeps the first day')
  const done = runFixture(off, { perUserMfaSeenOnAt: seen }).steps.find((s) => s.id === STEP)
  assert.equal(done?.status, 'done', 'Completed once every account reads Disabled')

  assert.equal(runFixture(off).steps.find((s) => s.id === STEP), undefined, 'a plan that never read one on has no step')
  assert.equal(runFixture(fixture('small')).steps.find((s) => s.id === STEP), undefined, 'nor does a scan with no per-user reading')
})
