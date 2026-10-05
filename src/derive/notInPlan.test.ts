// "In the baseline, not in this plan" (v2-research/missing-seven.md, decision C):
// every policy of the pinned baseline is shown somewhere on the Plan — a step,
// a Not licensed row, a review row, or this footer group — so a finished plan
// never reads as the whole baseline. Seven pinned policies used to appear
// nowhere, on every licence tier: the goal map claims none of them, and the
// coverage check's looser signature match kept them off the review rows.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { fixture, withReviewRow } from '../roadmap/fixtures/index.ts'
import type { FixtureName } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from '../roadmap/goalMap.ts'
import { externalMethodsEnabled, goalMapInUse } from '../coverage/companions.ts'
import { customerPlanSteps } from '../ui/surfaces/customerPlanSteps.ts'
import { stepById } from '../content/content.ts'
import { notLicensedRows } from './notLicensed.ts'
import { notInPlanLines, notInPlanRows, notInPlanSummary } from './notInPlan.ts'

const TENANTS: FixtureName[] = ['demo', 'small', 'mid', 'getiamai']

/** The tenant on the baseline the product ships, and the Plan as it is drawn: the steps the footer and the board receive. */
function planOf(name: FixtureName) {
  const f = { ...fixture(name), baseline: pinnedPackage() }
  const run = runFixture(f)
  const steps = customerPlanSteps(run.steps)
  return { run, steps, policies: f.baseline.policies, rows: notInPlanRows(f.baseline.policies, steps, run.coverage, PINNED_GOAL_MAP) }
}

const titleOf = (goalId: string): string => stepById[goalId]?.title ?? goalId

test('every pinned baseline policy is shown somewhere in the plan: a step, Not licensed, a review row, or In the baseline, not in this plan', () => {
  for (const name of TENANTS) {
    const { run, steps, policies, rows } = planOf(name)
    assert.equal(policies.length, 38, `${name}: the premise, the pinned 38-policy baseline`)
    // Where each surface names a baseline policy, read from what it draws.
    const goalsOf = (p: { id?: string | null; displayName: string }): string[] => Object.entries(PINNED_GOAL_MAP).filter(([, keys]) => keys.includes(p.id ?? p.displayName)).map(([g]) => g)
    const licenceTexts = notLicensedRows(run.coverage, PINNED_GOAL_MAP).map((r) => r.title)
    const reviewed = new Set(steps.flatMap((s) => (s.baselineReviewSource ? [s.baselineReviewSource.name] : [])))
    const listed = new Map(rows.map((r) => [r.policy, r]))
    const nowhere: string[] = []
    for (const p of policies) {
      // No policy is hidden any more: Jon's AVD allow-list block is a step since T2-AVD.
      const goals = goalsOf(p)
      const byStep = steps.some((s) => goals.includes(s.goalId))
      const byLicence = goals.some((g) => licenceTexts.some((t) => t.includes(titleOf(g))))
      const byReview = reviewed.has(p.displayName)
      const elsewhere = byStep || byLicence || byReview
      if (!elsewhere && !listed.has(p.displayName)) nowhere.push(p.displayName)
      // The group holds only what nothing else names: one place per policy.
      if (elsewhere) assert.ok(!listed.has(p.displayName), `${name}: "${p.displayName}" is shown elsewhere and listed again`)
    }
    assert.deepEqual(nowhere, [], `${name}: baseline policies the plan shows nowhere`)
    // The heading's count is the rows'.
    assert.ok(rows.length > 0, `${name}: the group is drawn`)
    assert.equal(notInPlanSummary(rows), `In the baseline, not in this plan (${rows.length})`, `${name}: the count in the heading`)
    assert.equal(new Set(rows.map((r) => r.policy)).size, rows.length, `${name}: one row per policy`)
  }
})

test('the list is derived from what the Plan draws, never a fixed set of policies', () => {
  const { run, steps, policies, rows } = planOf('demo')
  // A step the Plan draws takes its policies off the list: Prepare the Lockdown
  // Kit claims Jon's three ZTCA switches (T2-LK), so none is listed; without the
  // step, all three are.
  const switches = policies.filter((p) => /\bZTCA\b/i.test(p.displayName)).map((p) => p.displayName)
  assert.equal(switches.length, 3, 'the premise: the pin carries three ZTCA switches')
  for (const name of switches) assert.ok(!rows.some((r) => r.policy === name), `${name}: a drawn step takes its policy off the list`)
  const withoutKit = notInPlanRows(policies, steps.filter((s) => s.id !== 's-lockdown-kit'), run.coverage, PINNED_GOAL_MAP)
  for (const name of switches) assert.ok(withoutKit.some((r) => r.policy === name), `${name}: listed once the step that claims it is gone`)
  // A review row takes its policy off the list; without the review rows, their policies are listed.
  // (Jon's pin draws none since Phase 2b; a baseline carrying a policy no goal holds does.)
  {
    const f = withReviewRow({ ...fixture('demo'), baseline: pinnedPackage() })
    const r = runFixture(f)
    const drawn = customerPlanSteps(r.steps)
    const reviewed = drawn.filter((s) => s.baselineReviewSource).map((s) => s.baselineReviewSource!.name)
    assert.ok(reviewed.length > 0, 'the premise: the plan draws a review row')
    const noReviews = notInPlanRows(f.baseline.policies, drawn.filter((s) => !s.baselineReviewSource), r.coverage, PINNED_GOAL_MAP)
    for (const name of reviewed) assert.ok(noReviews.some((row) => row.policy === name), `${name}: listed once its review row is gone`)
  }
  // A Not licensed row's policies are never listed; with every goal licensed
  // away from the map, the same policies would have to be.
  const licensed = notLicensedRows(run.coverage, PINNED_GOAL_MAP)
  assert.ok(licensed.length > 0, 'the premise: the demo has Not licensed rows')
  const userRisk = policies.find((p) => (PINNED_GOAL_MAP['user-risk'] ?? []).includes(p.id ?? p.displayName))!
  assert.ok(!rows.some((r) => r.policy === userRisk.displayName), 'a Not licensed goal\'s policy is not listed again')
  // The baseline's policy that limits one emergency account is listed with the plan's own rule beside it.
  assert.match(rows.find((r) => r.policy === 'IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations')?.reason ?? '', /while the other stays excluded from everything/)
})

test('each footer row names its own reason: agent blocks, the unused EAM companion; the ZTCA switches are no row (T2-LK)', () => {
  const { rows } = planOf('demo')
  const reasonOf = (re: RegExp): string => rows.find((r) => re.test(r.policy))?.reason ?? ''
  assert.equal(reasonOf(/AGENT - BLOCK - HighRiskAgent/), 'Blocks AI agent identities, which need Microsoft Entra Agent ID. Not in this release.')
  assert.equal(reasonOf(/AGENT - BLOCK - NonTrustedAgents/), 'Blocks AI agent identities, which need Microsoft Entra Agent ID. Not in this release.')
  assert.deepEqual(rows.filter((r) => /\bZTCA\b/.test(r.policy)), [], 'Prepare the Lockdown Kit claims all three switches')
})

test('policies that read the same reason share one line on the Plan, the count still one per policy (owner, 2026-10-04)', () => {
  const { rows } = planOf('demo')
  const lines = notInPlanLines(rows)
  const agents = rows.filter((r) => /AGENT - BLOCK/.test(r.policy))
  assert.equal(agents.length, 2, "the premise: Jon's two AGENT blocks are listed")
  const agentLines = lines.filter((l) => l.text.includes('AGENT - BLOCK'))
  assert.equal(agentLines.length, 1, 'one line names both')
  assert.equal(agentLines[0].text, `${agents[0].policy} and ${agents[1].policy}: ${agents[0].reason}`)
  assert.equal(lines.length, new Set(rows.map((r) => r.reason)).size, 'one line per reason')
  assert.equal(notInPlanSummary(rows), `In the baseline, not in this plan (${rows.length})`, 'the heading still counts policies')
})

test('on a P2 tenant with no external MFA method, Jon\'s EAM High-Risk Users is listed, read from the same goal map the plan uses', () => {
  for (const name of TENANTS) {
    const f = { ...fixture(name), baseline: pinnedPackage() }
    if (externalMethodsEnabled(f.snapshot) === true) continue
    const run = runFixture(f)
    const steps = customerPlanSteps(run.steps)
    if (!steps.some((s) => s.goalId === 'user-risk')) continue
    const rows = notInPlanRows(f.baseline.policies, steps, run.coverage, goalMapInUse(PINNED_GOAL_MAP, f.snapshot))
    const eam = rows.find((r) => /\bEAM\b.*High-Risk/i.test(r.policy))
    assert.ok(eam, `${name}: EAM High-Risk Users is listed`)
    assert.match(eam.reason, /Needs Microsoft Entra ID P2, and only matters if you use one./)
    return
  }
  assert.fail('the premise: a fixture draws the user-risk step without an external MFA method')
})

// T2-FTR: no row of the pinned baseline falls back to the generic reason.
test('T2-FTR: Service Accounts and EntraConnectIDSync say which tenant fact keeps them off; BreakGlass says why the plan does without it; nothing reads the generic reason', () => {
  const generic = 'No step in this plan covers it for this tenant.'
  let sawServiceAccounts = false
  let sawSync = false
  for (const name of [...TENANTS, 'large', 'messy', 'hostile', 'midflight', 'demo-week2'] as FixtureName[]) {
    const { rows } = planOf(name)
    for (const r of rows) assert.notEqual(r.reason, generic, `${name}: ${r.policy} reads the generic reason`)
    const sa = rows.find((r) => /BLOCK – Service Accounts$/.test(r.policy))
    if (sa) {
      sawServiceAccounts = true
      assert.equal(sa.reason, 'Keeps service accounts to the office network. No service account is named in Identify Service and Shared Accounts.')
    }
    const sync = rows.find((r) => /EntraConnectIDSync/.test(r.policy))
    if (sync) {
      sawSync = true
      assert.equal(sync.reason, 'Keeps the directory sync account to its own network. No account here holds the Directory Synchronization Accounts role.')
    }
  }
  assert.ok(sawServiceAccounts && sawSync, 'the premise: a fixture lists both')
  const { rows } = planOf('demo')
  // ADM-Users is a step since 2026-10-04 (adminAccountsGroup.test.ts): no footer row names it.
  assert.equal(rows.some((r) => /MFA-Passkeys - ADM-Users/.test(r.policy)), false)
  assert.equal(rows.find((r) => /BreakGlass - TrustedLocations/.test(r.policy))?.reason, 'Requires a strong sign-in from one emergency account outside the office network, while the other stays excluded from everything (Establish Emergency Access). Not in this release.')
})

test('T2-FTR: a pinned policy keeps its reason by its stable id whatever it is called; a policy of another baseline is read by its name', () => {
  const { run, steps, policies } = planOf('demo')
  // Jon's BreakGlass policy (ADM-Users, the example here until 2026-10-04, is a step now).
  const emergency = policies.find((p) => p.id === '1588fdc7-f34a-468e-8023-4d788ef5d226')!
  const renamed = policies.map((p) => (p === emergency ? { ...p, displayName: 'Emergency sign-in outside the office' } : p))
  const byId = notInPlanRows(renamed, steps, run.coverage, PINNED_GOAL_MAP).find((r) => r.policy === 'Emergency sign-in outside the office')
  assert.match(byId?.reason ?? '', /^Requires a strong sign-in from one emergency account outside the office network/)
  // An upload's own copy, under another id, still reads its words by Jon's name.
  const uploaded = [{ id: 'upload-0001', displayName: 'IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations' }]
  assert.match(notInPlanRows(uploaded, [], run.coverage, {}).at(0)?.reason ?? '', /^Requires a strong sign-in from one emergency account outside the office network/)
})
