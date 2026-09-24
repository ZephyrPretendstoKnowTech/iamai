// B8 — the per-step content pass (docs/product/actionability/step-findings),
// each change read where the Plan reads it: the Source checked date from a
// package's verifiedSources, and the separate-accounts checklist as that step's
// Entra channel. The reviewed words themselves are pinned by docs/qa/step-snapshots.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { CONTRACT } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { packageSourceLine, sourceCheckedLine } from './stepPackage.ts'
import { sourceUpdatedOn } from '../../content/implementation/project.ts'
import { headingsOf, stepBodyOf } from './stepBody.ts'
import { TASK_HEAD } from './stepHeadings.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

const planOf = (name: FixtureName) => {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { r, ctx }
}

test('every package a step doc asks to date shows a dated Microsoft Learn source, no older than the 2026-09-12 check', () => {
  const dated = [
    's-prereq-break-glass', 's-prereq-exclusion-group', 's-verify-mfa', 's-goal-block-legacy-auth', 's-goal-admins-phishing-resistant',
    's-prereq-auth-strength', 's-prereq-trusted-location', 's-prereq-allowed-countries', 's-check-separate-admin-accounts', 's-goal-admin-session',
    's-goal-block-auth-transfer', 's-goal-block-device-code', 's-goal-guests-mfa', 's-goal-mfa-all-users', 's-goal-register-info-protected',
    's-goal-admin-portals-protected', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction', 's-goal-require-managed-device',
  ]
  for (const id of dated) {
    const pkg = PACKAGES[id]
    assert.ok(pkg, `${id}: not registered`)
    const sources = (pkg.meta.verifiedSources ?? []) as { checkedOn?: string; userFacing?: boolean; url?: string }[]
    // The date moves when a wave rechecks the facts (close-doors, 2026-09-19):
    // what is pinned is that the source is Microsoft's, shown to the person, and
    // no older than the sweep that established the line.
    assert.ok(
      sources.some((v) => v.userFacing === true && /^https:\/\/learn\.microsoft\.com\//.test(v.url ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(v.checkedOn ?? '') && (v.checkedOn as string) >= '2026-09-12'),
      `${id}: no Microsoft Learn source checked on or after 2026-09-12`,
    )
    assert.ok(packageSourceLine(pkg, CONTRACT.implementation), `${id}: no Source checked line`)
  }
})

// Every step that shows a Microsoft Learn link shows the day it was checked
// beside it (owner, 2026-09-20; quality audit section 2.5). Two families showed
// the link alone, for two different reasons, and neither may be given a date it
// does not hold.
test('a Learn link shows the day it was checked where no package is current: a set-aside package, a baseline conflict, a generated review row', () => {
  // s-goal-admin-portals-protected: its package is set aside (the baseline
  // changed under it) and on the demo its source is also self-contradictory, so
  // the step draws the translator's channels. When the page was checked is a
  // fact about the page, so the date stays on both plans.
  const expected = packageSourceLine(PACKAGES['s-goal-admin-portals-protected'], CONTRACT.implementation)
  assert.equal(sourceUpdatedOn(PACKAGES['s-goal-admin-portals-protected']), '2026-09-25')
  assert.ok(expected, 'the package records no checked date')
  for (const name of ['mid', 'demo'] as const) {
    const { r, ctx } = planOf(name)
    const step = r.steps.find((s) => s.id === 's-goal-admin-portals-protected')
    assert.ok(step, `${name}: the step is not on the plan`)
    const b = stepBodyOf(step, ctx)
    assert.ok(b.learnUrl, `${name}: no Learn link`)
    assert.equal(b.sourceLine, expected, `${name}: the Learn link shows no checked date`)
  }
  // The demo is the plan whose source contradicts itself; that is what used to
  // take the date away.
  const demo = planOf('demo')
  assert.notEqual(stepBodyOf(demo.r.steps.find((s) => s.id === 's-goal-admin-portals-protected')!, demo.ctx).conflictWords, null)
  // Every generated baseline-review row dates the planning page its Learn link points at.
  // The rows are built per tenant (roadmap/workflows.ts PLAN_CA) and have no
  // package, so the date is on the row's own Learn entry, from the source table
  // in docs/plans/ongoing-spec.md section 1 (`ms-plan-ca`, checked 2026-09-20).
  const rowLine = sourceCheckedLine('2026-09-25', CONTRACT.implementation)
  assert.ok(rowLine, 'no Source checked line for a recorded date')
  const rows = demo.r.steps.filter((s) => s.id.startsWith('s-review-baseline-'))
  assert.equal(rows.length, 4, 'the demo generates four review rows')
  for (const step of rows) {
    assert.equal((step.guidance as { learn?: { checkedOn?: string } } | undefined)?.learn?.checkedOn, '2026-09-25', step.id)
    const b = stepBodyOf(step, demo.ctx)
    assert.equal(b.learnUrl, 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access', step.id)
    assert.equal(b.sourceLine, rowLine, `${step.id}: the Learn link shows no checked date`)
  }
})

test('a step with no recorded check shows no date, and no line is invented for it', () => {
  // The rule has one direction only (S6): a date nothing recorded is not
  // rendered. `sourceCheckedLine` is the one producer, and it refuses anything
  // that is not a recorded ISO day.
  const W = CONTRACT.implementation
  assert.equal(sourceCheckedLine(null, W), null)
  assert.equal(sourceCheckedLine('', W), null)
  assert.equal(sourceCheckedLine('recently', W), null)
  assert.equal(sourceCheckedLine('2026-09', W), null)
})

test('Use Separate Accounts for Admin Work draws its per-person checklist as one Entra channel under Implementation', () => {
  const { r, ctx } = planOf('mid')
  const step = r.steps.find((s) => s.id === 's-check-separate-admin-accounts')
  assert.ok(step, 'the step is on the mid plan')
  const b = stepBodyOf(step, ctx)
  // A check step draws the task anatomy now (owner, 2026-09-19), so the region is Implementation Tasks.
  assert.ok(headingsOf(b).includes(TASK_HEAD.implementation), headingsOf(b).join(' · '))
  // Entra carries the checklist; AI Info describes it (B10 P1-4).
})
