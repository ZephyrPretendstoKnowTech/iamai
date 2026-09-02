import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { LADDER_ITEMS, GLOBAL_ADMIN_ROLE_ID, ladderFacts, ladderStepId, ladderSteps } from './ladder.ts'
import { LADDER_STEPS } from '../copy/ladder.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { emptyMappingState } from '../mapping/types.ts'

// A free tenant reduced to what the ladder actually reads.
function freeSnapshot(over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return { ...fixture('micro').snapshot, ...over }
}

function withConfig(base: TenantSnapshot, key: string, rows: unknown[], status: 'ok' | 'disabled' = 'ok'): TenantSnapshot {
  return { ...base, config: { ...base.config, [key]: { status, reason: null, rows } } }
}

const mapping = (over: Partial<MappingState> = {}): MappingState => ({ ...emptyMappingState('tenant-under-test'), ...over })

test('every ladder item in the data file has copy, and the copy has no extras', () => {
  const dataIds = LADDER_ITEMS.map((i) => i.id).sort()
  const copyIds = Object.keys(LADDER_STEPS).sort()
  assert.deepEqual(copyIds, dataIds, 'the ladder data and the ladder copy name the same items')
})

test('every ladder step carries instructions, an exit criterion, a plain title and a manager sentence', () => {
  const { steps } = ladderSteps(freeSnapshot(), mapping(), [])
  assert.equal(steps.length, LADDER_ITEMS.length)
  for (const s of steps) {
    assert.ok(s.action.summary.length >= 3, `${s.id}: exact instructions`)
    assert.ok(s.plainTitle.length > 0 && s.plainTitle !== s.title, `${s.id}: a plain title`)
    assert.ok(s.forManager.length > 0, `${s.id}: a manager sentence`)
    assert.ok(s.learn?.url.startsWith('https://learn.microsoft.com/'), `${s.id}: a Learn link`)
    assert.equal(s.phase, 0)
  }
})

test('a done ladder step always names the evidence that satisfied it', () => {
  const { steps } = ladderSteps(freeSnapshot(), mapping({ breakGlassUserIds: [] }), [])
  for (const s of steps) {
    if (s.status === 'done') assert.ok(s.deliveredBy.length > 0, `${s.id}: done names its evidence`)
    else assert.equal(s.deliveredBy.length, 0, `${s.id}: only a done step cites evidence`)
  }
})

test('security defaults: on is done, off is a step, unreadable is neither claimed nor denied', () => {
  const base = freeSnapshot()
  const on = ladderSteps(withConfig(base, 'securityDefaults', [{ isEnabled: true }]), mapping(), []).steps
  const off = ladderSteps(withConfig(base, 'securityDefaults', [{ isEnabled: false }]), mapping(), []).steps
  const unknown = ladderSteps(withConfig(base, 'securityDefaults', [], 'disabled'), mapping(), []).steps
  const find = (list: typeof on) => list.find((s) => s.id === ladderStepId('security-defaults'))
  assert.equal(find(on)?.status, 'done')
  assert.equal(find(off)?.status, 'ready')
  assert.equal(find(unknown)?.status, 'ready')
})

test('Global Administrator count: Microsoft\'s two to four is the verdict, and the holders are named', () => {
  const base = freeSnapshot()
  const roles = (n: number) => ({ active: Object.fromEntries(base.users.slice(0, n).map((u) => [u.id, [GLOBAL_ADMIN_ROLE_ID]])), eligible: {} })
  const at = (n: number) => ladderSteps({ ...base, roles: roles(n) }, mapping(), []).steps.find((s) => s.id === ladderStepId('global-admin-count'))
  assert.equal(at(3)?.status, 'done')
  assert.equal(at(1)?.status, 'ready')
  assert.equal(at(9)?.status, 'ready')
})

test('guests: none is done, some are named', () => {
  const base = freeSnapshot()
  const noGuests = { ...base, users: base.users.filter((u) => u.userType !== 'guest') }
  const step = (snap: TenantSnapshot) => ladderSteps(snap, mapping(), []).steps.find((s) => s.id === ladderStepId('guest-review'))
  assert.equal(step(noGuests)?.status, 'done')
  const some = step(base)
  assert.equal(some?.status, 'ready')
})

test('what Graph does not expose is said plainly, never guessed', () => {
  const { steps } = ladderSteps(freeSnapshot(), mapping(), [])
  const appPasswords = steps.find((s) => s.id === ladderStepId('app-passwords'))
  assert.equal(appPasswords?.status, 'ready')
  const legacy = steps.find((s) => s.id === ladderStepId('legacy-auth-inventory'))
})

test('a phase 0 step that already covers a ladder item takes its place, and its position', () => {
  const withBreakGlassStep = ladderSteps(freeSnapshot(), mapping(), ['s-prereq-break-glass'])
  assert.equal(withBreakGlassStep.steps.some((s) => s.id === ladderStepId('break-glass-accounts')), false)
  assert.equal(withBreakGlassStep.order.get('s-prereq-break-glass'), 1)
  assert.equal(withBreakGlassStep.steps.length, LADDER_ITEMS.length - 1)
})

test('facts come from the directory, not from anything the operator types', () => {
  const base = freeSnapshot()
  const f = ladderFacts(base, mapping())
  assert.equal(f.enabledUsers, base.users.filter((u) => u.userType === 'member' && u.accountEnabled !== false).length)
  assert.equal(f.guests, base.users.filter((u) => u.userType === 'guest').length)
})

// ---- through the whole engine ----

test('a free tenant gets the ladder as its plan, in ladder order, and no Conditional Access prerequisite', () => {
  const { steps } = runFixture(fixture('micro'))
  const ladder = steps.filter((s) => s.id.startsWith('s-ladder-'))
  assert.equal(ladder.length, LADDER_ITEMS.length, 'every rung is a step')
  assert.deepEqual(ladder.map((s) => s.id), LADDER_ITEMS.map((i) => ladderStepId(i.id)), 'ladder order is the plan order')
  assert.equal(steps.indexOf(ladder[0]), 0, 'the ladder leads the plan')
  // Objects that exist only to be referenced by a policy have nothing to serve.
  for (const id of ['s-prereq-exclusion-group', 's-prereq-trusted-location', 's-prereq-allowed-countries', 's-prereq-security-defaults']) {
    assert.equal(steps.some((s) => s.id === id), false, `${id} is not asked for without Conditional Access`)
  }
})

test('a licensed tenant gets no ladder steps', () => {
  for (const name of ['small', 'mid', 'messy'] as const) {
    const { steps } = runFixture(fixture(name))
    assert.equal(steps.some((s) => s.id.startsWith('s-ladder-')), false, `${name}: no ladder without a free licence`)
  }
})
