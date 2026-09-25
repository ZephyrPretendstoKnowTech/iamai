// Phase 2b (owner, 2026-09-24): Jon's AVD and SharePoint and OneDrive blocks
// outside the trusted network are policy steps, not review rows; his AVD
// allow-list block and WindowsAzureAD-BaselineScopes each depend on a group his
// baseline never identifies, and are hidden from every surface for v1.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { pinnedPackage } from '../baseline/pinned.ts'

const AVD = 's-goal-avd-trusted-network'
const SPO = 's-goal-sharepoint-trusted-network'

function withServices(answer: 'yes' | 'no'): Fixture {
  const f = structuredClone(fixture('demo'))
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), avd: answer, sharepoint: answer }
  // As decisions.ts records a saved service answer: the facet override coverage reads.
  const override = { on: answer === 'yes', reason: answer === 'yes' ? 'confirmed in use' : 'confirmed not in use' }
  f.mapping.facetOverrides = { ...f.mapping.facetOverrides, avd: override, sharepoint: override }
  return f
}

test('the pin maps Jon’s AVD and SharePoint blocks outside the trusted network to goals of their own, and nothing else moved', () => {
  assert.deepEqual(PINNED_GOAL_MAP['avd-trusted-network'], ['b13dd393-f644-45c8-81bf-aa7f4032ebd3'], 'IAC - APP – BLOCK – AVD - NonTrustedLocations')
  assert.deepEqual(PINNED_GOAL_MAP['sharepoint-trusted-network'], ['1f960ec9-885f-4032-a6b2-a5c559279274'], 'IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations')
  const mapped = Object.values(PINNED_GOAL_MAP).flat()
  assert.equal(mapped.includes('9bc2ad69-4aed-4242-807d-788446196b8b'), false, 'the AVD allow-list block is no goal’s')
})

test('used, they are policy steps; no review row stands for any of the four', () => {
  const r = runFixture(withServices('yes'))
  for (const id of [AVD, SPO]) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} is on the plan`)
    assert.ok(s.kind === 'create' || s.kind === 'adjust', `${id}: ${s.kind}`)
    assert.ok(s.action.resolution?.policies.length || s.action.planned?.policies.length, `${id} hands over a policy`)
  }
  assert.deepEqual(r.steps.filter((s) => s.id.startsWith('s-review-baseline-')).map((s) => s.baselineReviewSource?.name), [], 'no review row is left for the AVD, SharePoint or BaselineScopes policies')
  const rows = notInPlanRows(pinnedPackage().policies, r.steps, r.coverage, PINNED_GOAL_MAP).map((x) => x.policy)
  assert.equal(rows.some((p) => /AllowedAVDUsers|WindowsAzureAD-BaselineScopes/i.test(p)), false, `hidden from the not-in-plan list too: ${rows.join(' | ')}`)
})

test('answered No, each reads Doesn’t apply, as Inforcer does', () => {
  const r = runFixture(withServices('no'))
  for (const id of [AVD, SPO]) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} stays as a row`)
    assert.ok(s.doesntApply && s.doesntApplyByAnswer, `${id}: ${s.doesntApply}`)
  }
})
