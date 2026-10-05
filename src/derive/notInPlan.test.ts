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
import { pages, stepById } from '../content/content.ts'
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
  // Jon's BreakGlass - TrustedLocations is a step since 2026-10-05 (emergencyStrongAccount.test.ts): no footer row names it.
  assert.equal(rows.some((r) => r.policy === 'IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations'), false)
})

test('each footer row names its own reason; the ZTCA switches (T2-LK) and the two AGENT blocks (owner, 2026-10-04) are no row', () => {
  for (const name of TENANTS) {
    const { steps, rows, run } = planOf(name)
    assert.deepEqual(rows.filter((r) => /\bZTCA\b/.test(r.policy)), [], `${name}: Prepare the Lockdown Kit claims all three switches`)
    // Jon's two AGENT blocks are steps: Block AI Agents You Have Not Approved is
    // drawn, and Block High-Risk AI Agents is drawn or, without Entra ID P2, a
    // Not licensed row. Neither is listed, and no reason names them.
    assert.deepEqual(rows.filter((r) => /AGENT - BLOCK/.test(r.policy)), [], `${name}: the agent blocks are no footer row`)
    assert.ok(steps.some((s) => s.goalId === 'agents-block-untrusted'), `${name}: the untrusted-agents block is a step`)
    const highRisk = steps.some((s) => s.goalId === 'agents-block-high-risk') || notLicensedRows(run.coverage, PINNED_GOAL_MAP).some((r) => r.title.includes(titleOf('agents-block-high-risk')))
    assert.ok(highRisk, `${name}: the high-risk agents block is a step or a Not licensed row`)
  }
  const reasons = (pages.plan as unknown as { footer: { notInPlanReason: Record<string, string> } }).footer.notInPlanReason
  assert.equal(reasons.agentBlock, undefined, 'the agent-block reason is gone with its rows')
})

test('policies that read the same reason share one line on the Plan, the count still one per policy (owner, 2026-10-04)', () => {
  // Jon's two AGENT blocks were the pin's one pair sharing a reason; they are
  // steps since 2026-10-04, so two rows of the drawn footer are given one
  // reason, which is how any baseline's shared reason reaches the lines.
  const { rows: drawn } = planOf('small')
  assert.ok(drawn.length >= 2, 'the premise: the footer lists at least two policies')
  const shared = 'One reason both read.'
  const rows = drawn.map((r, i) => (i < 2 ? { ...r, reason: shared, text: `${r.policy}: ${shared}` } : r))
  const lines = notInPlanLines(rows)
  const sharedLines = lines.filter((l) => l.text.endsWith(shared))
  assert.equal(sharedLines.length, 1, 'one line names both')
  assert.equal(sharedLines[0].text, `${rows[0].policy} and ${rows[1].policy}: ${shared}`)
  assert.equal(sharedLines[0].count, 2)
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
test('T2-FTR: Service Accounts and EntraConnectIDSync say which tenant fact keeps them off; nothing reads the generic reason', () => {
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
  // Nor BreakGlass - TrustedLocations, a step since 2026-10-05 (emergencyStrongAccount.test.ts), and its reason is gone.
  assert.equal(rows.some((r) => /BreakGlass - TrustedLocations/.test(r.policy)), false)
  assert.equal((pages.plan as unknown as { footer: { notInPlanReason: Record<string, string> } }).footer.notInPlanReason.emergencyAccount, undefined)
})

test('T2-FTR: a pinned policy keeps its reason by its stable id whatever it is called; a policy of another baseline is read by its name', () => {
  const { run, steps, policies } = planOf('demo')
  // Jon's countries block with no travel exception (ADM-Users until 2026-10-04 and
  // BreakGlass until 2026-10-05 were the example here; both are steps now).
  const countries = policies.find((p) => p.id === '1eaf943a-abad-4c77-b101-0c5342fc1044')!
  const renamed = policies.map((p) => (p === countries ? { ...p, displayName: 'Block some countries for everyone' } : p))
  const byId = notInPlanRows(renamed, steps, run.coverage, PINNED_GOAL_MAP).find((r) => r.policy === 'Block some countries for everyone')
  assert.match(byId?.reason ?? '', /^Blocks countries outright, travellers included/)
  // An upload's own copy, under another id, still reads its words by Jon's name.
  const uploaded = [{ id: 'upload-0001', displayName: countries.displayName }]
  assert.match(notInPlanRows(uploaded, [], run.coverage, {}).at(0)?.reason ?? '', /^Blocks countries outright, travellers included/)
})
