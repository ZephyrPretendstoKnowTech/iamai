import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { LADDER_ITEMS, GLOBAL_ADMIN_ROLE_ID, ladderStepId, ladderSteps } from './ladder.ts'
import { OPERATOR_PASSKEY_STEP_ID } from './passkeySettings.ts'
import { SEPARATE_ADMIN_ACCOUNTS_STEP_ID } from './stepIds.ts'
import { readFileSync } from 'node:fs'
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

test('the dormant ladder still builds its verdicts: a done rung names its evidence; security defaults, the Global Administrator count and guests are read from the directory', () => {
  // a done ladder step always names the evidence that satisfied it
  {
    const { steps } = ladderSteps(freeSnapshot(), mapping({ breakGlassUserIds: [] }), [])
    for (const s of steps) {
      if (s.status === 'done') assert.ok(s.deliveredBy.length > 0, `${s.id}: done names its evidence`)
      else if (s.id === ladderStepId('per-user-mfa-cleanup')) { assert.equal(s.state.satisfied, false); assert.match(s.deliveredBy.join(' '), /migration.*Check legacy per-user MFA separately/, 'migration evidence alone does not prove per-user cleanup') }
      else assert.equal(s.deliveredBy.length, 0, `${s.id}: only a done step cites evidence`)
    }
  }

  // security defaults: on is done, off is a step, unreadable is neither claimed nor denied
  {
    const base = freeSnapshot()
    const on = ladderSteps(withConfig(base, 'securityDefaults', [{ isEnabled: true }]), mapping(), []).steps
    const off = ladderSteps(withConfig(base, 'securityDefaults', [{ isEnabled: false }]), mapping(), []).steps
    const unknown = ladderSteps(withConfig(base, 'securityDefaults', [], 'disabled'), mapping(), []).steps
    const find = (list: typeof on) => list.find((s) => s.id === ladderStepId('security-defaults'))
    assert.equal(find(on)?.status, 'done')
    assert.equal(find(off)?.status, 'ready')
    assert.equal(find(unknown)?.status, 'ready')
  }

  // Global Administrator count: Microsoft's two to four is the verdict, and the holders are named
  {
    const base = freeSnapshot()
    const roles = (n: number) => ({ active: Object.fromEntries(base.users.slice(0, n).map((u) => [u.id, [GLOBAL_ADMIN_ROLE_ID]])), eligible: {} })
    const at = (n: number) => ladderSteps({ ...base, roles: roles(n) }, mapping(), []).steps.find((s) => s.id === ladderStepId('global-admin-count'))
    assert.equal(at(3)?.status, 'done')
    assert.equal(at(1)?.status, 'ready')
    assert.equal(at(9)?.status, 'ready')
  }

  // guests: none is done, some are named
  {
    const base = freeSnapshot()
    const noGuests = { ...base, users: base.users.filter((u) => u.userType !== 'guest') }
    const step = (snap: TenantSnapshot) => ladderSteps(snap, mapping(), []).steps.find((s) => s.id === ladderStepId('guest-review'))
    assert.equal(step(noGuests)?.status, 'done')
    const some = step(base)
    assert.equal(some?.status, 'ready')
  }
})

// ---- through the whole engine ----

test('a tenant that cannot use Conditional Access gets no plan at all, and a licensed tenant gets no ladder steps', () => {
  // a tenant that cannot use Conditional Access gets no plan at all
  {
    // Owner, 2026-09-20: Entra ID P1 is the real minimum, and no opinion beats a
    // half-baked one. `micro` has no Conditional Access licence, so the whole plan
    // is withheld — not the Conditional Access steps only, which would leave three
    // identity checks standing and read as "the plan".
    const { steps } = runFixture(fixture('micro'))
    assert.equal(steps.length, 0, 'no licence, no plan')
    // The free-tier ladder that used to be that plan is still in the tree, dormant
    // behind one flag the owner asked to keep for a later comparison. It is off,
    // and turning it on is a visible one-line change rather than a drift.
    assert.match(readFileSync('src/roadmap/generate.ts', 'utf8'), /const FREE_TIER_LADDER = false/)
    // Dormant, not dead: the rungs above still build, so the words and the evidence
    // stay under test while the flag is off.
    assert.equal(ladderSteps(freeSnapshot(), mapping(), []).steps.length, LADDER_ITEMS.length)
  }

  // a licensed tenant gets no ladder steps
  {
    for (const name of ['small', 'mid', 'messy'] as const) {
      const { steps } = runFixture(fixture(name))
      // The operator's own passkey rung (A5 task 5) is not a free-tier ladder item: it is asked of a licensed tenant's operator.
      assert.equal(steps.some((s) => s.id.startsWith('s-ladder-') && s.id !== OPERATOR_PASSKEY_STEP_ID), false, `${name}: no ladder without a free licence`)
    }
  }
})

test('separation review includes eligible role holders but excludes emergency accounts', () => {
  // On the one step that does the review, whatever the licence: the ladder's
  // second id for it is gone (finding 9).
  // A licensed tenant, because since 2026-09-20 an unlicensed one has no plan to
  // find the step on. The population rule under test is the same either way.
  const base = fixture('small')
  const snapshot = { ...base.snapshot }
  const [ordinary, emergency] = snapshot.users.slice(0, 2)
  snapshot.roles = { active: { [emergency.id]: [GLOBAL_ADMIN_ROLE_ID] }, eligible: { [ordinary.id]: [GLOBAL_ADMIN_ROLE_ID] } }
  const m = mapping({ breakGlassUserIds: [emergency.id] })
  const step = runFixture({ ...base, snapshot, mapping: m }, { mapping: m }).steps.find(s => s.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID)
  assert.ok(step, 'the review is on the plan')
  assert.equal(ladderSteps(snapshot, m, [SEPARATE_ADMIN_ACCOUNTS_STEP_ID, 's-check-dormant-accounts']).steps.some(s => s.id === ladderStepId('admin-accounts-separate')), false)
})
