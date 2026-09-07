// Task 019 — the known baseline conflict belongs to the source policy a review
// read, and it is proved here through the product's *own* baseline loading path.
//
// Task 010 moved the conflict off the goal id and onto the reviewed source
// (baselineConflict.ts `baselineConflicts(map, pkg)`), and its tests follow that
// with a hand-swapped map and with fixtures that do not carry the source. What
// they do not do is load a baseline the way the product loads one. This file
// does, because the case Task 019 exists for is a person's own package:
//
//   loadUploadedBaseline(files) → its own goal map → coverage → generation →
//   the operations authority → the Step Contract → the artifacts
//
// The two truths held apart, both at once:
//
//   1. IAMAI's retained pin still contradicts itself about the Microsoft admin
//      portals, and the step it produces still offers nothing to implement; and
//   2. an uploaded package that hands the same goal a policy of its own does not
//      inherit that contradiction, because a goal id is a label and the
//      contradiction is a fact about a policy.
//
// And the third, which is what keeps 2 from being a hole: not carrying the
// pinned source's contradiction is not a clean bill of health. The uploaded
// policy goes through every ordinary authority, and a hold any of them raises
// still holds it (section 3).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPinnedBaseline, loadUploadedBaseline } from '../ui/baseline.ts'
import type { BaselineResult } from '../ui/baseline.ts'
import { PINNED } from '../baseline/pinned.ts'
import { REVIEWED_SOURCES, baselineConflictWords, baselineConflicts, inBaselineConflict } from './baselineConflict.ts'
import { PINNED_GOAL_MAP, policyKey } from './goalMap.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { implementationOffered, policyResult, unavailableReason } from './operations.ts'
import { nextMilestone } from './lifecycle.ts'
import { stepContext } from './prompts.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { stepExportView, stepLines } from '../ui/surfaces/stepExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { jsonOffered } from '../ui/surfaces/stepJson.ts'
import { stepPortalLines, portalNamesFor } from '../ui/surfaces/stepPortal.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import type { Step } from './types.ts'

const GOAL = 'admin-portals-protected'
const SOURCE = 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'
/** The one key the uploaded alternate uses for its own admin-portals policy. */
const OWN_KEY = '9d1d3f7a-5c2e-4d18-b0a3-2f6c7e51a4b7'

/** The reviewed source policy as the pin carries it, so an upload can carry the same one. */
const PINNED_SOURCE = PINNED.policies.find((p) => String(p.id ?? '').toLowerCase() === SOURCE)
assert.ok(PINNED_SOURCE, 'the pinned package no longer carries the reviewed Admin Portal source')

/** A package a person uploaded, built by the product's own upload path. */
function uploaded(...policies: Record<string, unknown>[]): BaselineResult {
  return loadUploadedBaseline(policies.map((p, i) => ({ path: `Policies/uploaded-${i}.json`, text: JSON.stringify(p) })))
}

/**
 * A person's own admin-portals policy: the same goal identity as the pinned
 * source under the pin-time rule (block, all users, the admin portals), and a
 * policy id and name of its own. Nothing about it is the package the review read.
 */
function ownAdminPortalPolicy(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: OWN_KEY,
    displayName: 'Contoso - Block - Admin portals',
    state: 'enabledForReportingButNotEnforced',
    conditions: {
      applications: { includeApplications: ['MicrosoftAdminPortals'], excludeApplications: [], includeUserActions: [], includeAuthenticationContextClassReferences: [] },
      clientAppTypes: ['all'],
      signInRiskLevels: [],
      userRiskLevels: [],
      servicePrincipalRiskLevels: [],
      users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] },
    },
    grantControls: { operator: 'OR', builtInControls: ['block'], customAuthenticationFactors: [], termsOfUse: [] },
    sessionControls: null,
    ...over,
  }
}

type Case = { r: ReturnType<typeof runFixture>; step: Step; ctx: StepVarContext; contract: ReturnType<typeof stepContract> }

/**
 * The demo tenant planning against a loaded baseline, wired exactly as
 * ui/surfaces/planData.ts wires the Plan page: the package *and* the goal map
 * that package came with, into coverage and into generation.
 */
function plan(b: BaselineResult, goalId: string = GOAL): Case {
  const f = fixture('demo-week2')
  const r = runFixture(f, { baseline: b.pkg, goalMap: b.goalMap })
  const step = r.steps.find((s) => s.goalId === goalId)
  assert.ok(step, `the ${goalId} step is in the plan`)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { r, step: step as Step, ctx, contract: stepContract(step as Step, ctx, stepVars(step as Step, ctx)) }
}

/** Everything that would carry an implementation, on every channel the product has. */
function implementationChannels(step: Step, ctx: StepVarContext): { json: string | null; portalSteps: unknown[]; portalLines: unknown; tabs: boolean; contract: boolean; offered: boolean } {
  const cs = contentStepFor(step) as Record<string, unknown>
  const ex = stepVars(step, ctx) as Record<string, unknown>
  return {
    json: step.action.json,
    portalSteps: step.action.portalSteps ?? [],
    portalLines: stepPortalLines(step, portalNamesFor(ctx, ex, String(cs.title))),
    tabs: jsonOffered(step),
    contract: stepContract(step, ctx, stepVars(step, ctx)).implementation.offered,
    offered: implementationOffered(step as never),
  }
}

// ---- 0: the conflict record is keyed on a source policy, never on a goal ----

test('every reviewed source names a policy the pin carries, not a goal', () => {
  const keys = new Set(PINNED.policies.map((p) => policyKey({ id: p.id, displayName: p.displayName }).toLowerCase()))
  const goalIds = new Set(Object.keys(PINNED_GOAL_MAP))
  for (const reviewed of REVIEWED_SOURCES) {
    assert.equal(goalIds.has(reviewed.key), false, `${reviewed.key} is a goal id, so the conflict would follow the label rather than the source`)
    assert.equal(keys.has(reviewed.key), true, `${reviewed.key} names no policy in the pinned package`)
  }
  assert.equal(REVIEWED_SOURCES.some((r) => r.key === GOAL), false, 'the admin-portals goal id is registered as a conflicted source')
})

// ---- 1: the retained pin, loaded the way the product loads it, still conflicts ----

test('the pinned baseline the product loads still contradicts itself, and offers nothing', async () => {
  const pin = await loadPinnedBaseline()
  // It really is the retained pin, at the commit the pin records — not a fixture
  // standing in for one.
  assert.equal(pin.origin.kind, 'github')
  assert.equal(pin.origin.kind === 'github' ? pin.origin.commit : null, PINNED.commit)
  assert.deepEqual([...baselineConflicts(pin.goalMap ?? PINNED_GOAL_MAP, pin.pkg)], [[GOAL, SOURCE]], 'the pinned package no longer reads as self-contradictory')

  const { step, ctx, contract } = plan(pin)
  assert.equal(inBaselineConflict(step), true, 'the pinned Admin Portal step lost its conflict')
  assert.equal(step.state.conflictSource, SOURCE, 'the step does not record which source contradicts itself')
  assert.ok(step.blockers.some((b) => b.label === 'baseline-conflict'), 'the conflict blocker is gone')
  assert.equal(step.blockedReason, BLOCKED_REASON.baseline, 'the row blames something other than the baseline')
  assert.ok(baselineConflictWords(step), 'the step carries no explanation of the contradiction')

  // No implementation, on any channel, and no date.
  const result = policyResult(step as never)
  assert.equal(result.kind, 'unavailable')
  assert.equal(unavailableReason(step as never), 'baseline-conflict')
  const ch = implementationChannels(step, ctx)
  assert.equal(ch.json, null, 'a submittable body exists for a policy nobody can write')
  assert.deepEqual(ch.portalSteps, [], 'portal steps exist')
  assert.equal(ch.portalLines, null, 'portal instructions exist')
  assert.equal(ch.tabs, false, 'the JSON, PowerShell and Download tabs are offered')
  assert.equal(ch.contract, false, 'the Step Contract offers an implementation')
  assert.equal(ch.offered, false, 'the operations authority offers an implementation')
  assert.equal(nextMilestone(step).at, null, 'an enforcement date was manufactured')
  assert.equal(contract.milestone.at, null)
  assert.equal(stepExportView(step, ctx).dates, null, 'the artifacts carry a Dates line')
  assert.equal(stepExportView(step, ctx).ifWrong, null, 'the artifacts carry a rollback for a change IAMAI will not define')
})

// ---- 2: an uploaded package handed the same goal does not inherit it ----

test('an uploaded baseline that maps its own policy to the same goal carries no pinned conflict', () => {
  const up = uploaded(ownAdminPortalPolicy())
  // The same goal identity, under the same pin-time rule: this is the case that
  // a goal-id-keyed conflict would have blocked.
  assert.deepEqual(up.goalMap?.[GOAL], [OWN_KEY], 'the uploaded policy does not stand for the admin-portals goal, so this proves nothing')
  assert.deepEqual([...baselineConflicts(up.goalMap ?? {}, up.pkg)], [], "an uploaded package inherited the pinned source's contradiction")

  const { step, ctx, contract } = plan(up)
  assert.equal(inBaselineConflict(step), false, 'the goal id alone still blocks the step')
  assert.notEqual(step.state.condition, 'baseline-conflict')
  assert.equal(step.state.conflictSource ?? null, null, 'the step records a conflicted source it does not carry')
  assert.deepEqual(step.blockers.filter((b) => b.label === 'baseline-conflict'), [], 'a conflict blocker was raised for a source that carries no conflict')
  assert.notEqual(step.blockedReason, BLOCKED_REASON.baseline, "the row read a contradiction the step's own source does not have")
  assert.equal(baselineConflictWords(step), null, 'the step explains a contradiction its own source does not have')
  assert.notEqual(unavailableReason(step as never), 'baseline-conflict', 'the operations authority still read the pinned source')

  // And it is planned: a body, a rollout stage, and the offer on every channel.
  const ch = implementationChannels(step, ctx)
  assert.equal(typeof ch.json, 'string', 'no policy body was written for a source nothing contradicts')
  assert.equal(ch.offered, true, 'the implementation was withdrawn from a source that carries no contradiction')
  assert.equal(ch.contract, true, 'the Step Contract withheld an implementation the authority offers')
  assert.equal(ch.tabs, true, 'the JSON, PowerShell and Download tabs are withheld')
  assert.notEqual(step.state.lifecycle, null, 'the step lost its rollout stage')
  assert.doesNotMatch(contract.whatToDo.text, /reviewed baseline|baseline defines/i, 'the next action is the resolve-the-conflict one')

  // And no artifact tells anybody to go and resolve a contradiction.
  const rendered = [...stepLines(step, ctx), JSON.stringify(stepExportView(step, ctx)), stepContext(step, (s) => stepExportView(s, ctx))].join('\n')
  assert.equal(/reviewed baseline/i.test(rendered), false, 'an artifact asks for a reviewed baseline the upload never contradicted')
  assert.equal(rendered.includes(SOURCE), false, 'the pinned source policy id reached an uploaded baseline’s artifacts')
})

// ---- 3: isolation is not a bypass — every ordinary authority still holds ----

test('the same uploaded baseline is still held when an ordinary authority says so', () => {
  // The person's own admin-portals policy, granting against their own terms of
  // use: a tenant-specific object this tenant does not hold. Nothing about the
  // pinned contradiction is involved, and the step is unavailable all the same —
  // for the reason the existing authority gives, not one Task 019 invented.
  const up = uploaded(
    ownAdminPortalPolicy({
      grantControls: { operator: 'OR', builtInControls: ['mfa'], customAuthenticationFactors: [], termsOfUse: ['aaaa0000-0000-4000-8000-0000000000bb'] },
    }),
  )
  assert.deepEqual([...baselineConflicts(up.goalMap ?? {}, up.pkg)], [], 'the upload inherited the pinned contradiction')

  const { step, ctx } = plan(up)
  assert.equal(inBaselineConflict(step), false, 'the upload inherited the pinned contradiction')
  assert.equal(unavailableReason(step as never), 'missing-object', 'an unresolved tenant object stopped holding the step')
  assert.ok((step.action.missing ?? []).length > 0, 'the unresolved reference is not reported')
  const ch = implementationChannels(step, ctx)
  assert.equal(ch.offered, false, 'an implementation was offered against an object the tenant does not have')
  assert.equal(ch.contract, false, 'the Step Contract offers what the authority withholds')
  assert.equal(ch.tabs, false, 'the JSON, PowerShell and Download tabs are offered')
})

// ---- 4: the source is the policy, not what it is called ----

test('the reviewed source is recognised under another display name, and its name alone recognises nothing', () => {
  // Same policy, same id, renamed by whoever exported it: still the source the
  // review read, still contradictory, still no implementation.
  const renamed = uploaded({ ...(PINNED_SOURCE as unknown as Record<string, unknown>), displayName: 'Corp - Block - Portals (2026 revision)' })
  assert.deepEqual([...baselineConflicts(renamed.goalMap ?? {}, renamed.pkg)], [[GOAL, SOURCE]], 'renaming the reviewed source hid its contradiction')
  const wasRenamed = plan(renamed)
  assert.equal(inBaselineConflict(wasRenamed.step), true, 'a rename cleared the contradiction')
  assert.equal(implementationChannels(wasRenamed.step, wasRenamed.ctx).offered, false, 'a rename bought an implementation')

  // A different policy wearing the reviewed source's name: not that source, and
  // no finding of IAMAI's attaches to it.
  const namesake = uploaded(ownAdminPortalPolicy({ displayName: (PINNED_SOURCE as unknown as { displayName: string }).displayName }))
  assert.deepEqual([...baselineConflicts(namesake.goalMap ?? {}, namesake.pkg)], [], 'a display name was taken as proof of provenance')
  const wasNamesake = plan(namesake)
  assert.equal(inBaselineConflict(wasNamesake.step), false, 'a display name was taken as proof of provenance')
  assert.equal(baselineConflictWords(wasNamesake.step), null, 'a namesake policy is explained as the reviewed source')
})

// ---- 5: an upload is not an exemption — the reviewed source is the reviewed source ----

test('uploading the reviewed source itself still reports the contradiction', () => {
  // Nothing here turns on where a package came from. The same policy, handed to
  // the same goal by an uploaded package's own map, is read the same way: Task
  // 019 isolates an alternate source, it does not exempt an upload.
  const up = uploaded(PINNED_SOURCE as unknown as Record<string, unknown>)
  assert.deepEqual(up.goalMap?.[GOAL], [SOURCE], 'the uploaded reviewed source no longer stands for the goal')
  assert.deepEqual([...baselineConflicts(up.goalMap ?? {}, up.pkg)], [[GOAL, SOURCE]], 'an uploaded copy of the reviewed source escaped its own contradiction')

  const { step, ctx } = plan(up)
  assert.equal(inBaselineConflict(step), true, 'an uploaded copy of the reviewed source escaped its own contradiction')
  assert.equal(step.state.conflictSource, SOURCE)
  assert.equal(implementationChannels(step, ctx).offered, false, 'an upload bought an implementation the pin is refused')
  assert.equal(implementationChannels(step, ctx).tabs, false, 'the JSON, PowerShell and Download tabs are offered')
})
