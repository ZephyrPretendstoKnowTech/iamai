// B10 P0-10: the MFA Registration Campaign stays open
// until a person saves who needs special care, nobody included (S-MC-2, A6, U28).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import data from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLane } from '../../actionability/lanes.ts'
import type { ConditionState, PrerequisiteState, StepObservation } from '../../actionability/lanes.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { SPECIAL_CARE_STEP_ID, questionLabels, unsavedInputsOf } from '../../roadmap/answers.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'

const CAMPAIGN = SPECIAL_CARE_STEP_ID

/** Every other step complete, every condition not applicable: the campaign's reading depends on itself. */
function readCampaign(obs: StepObservation): string {
  const steps: Record<string, StepObservation> = {}
  for (const s of data.steps) steps[s.id] = { complete: true }
  const conditions: Record<string, ConditionState> = {}
  for (const c of data.conditions) conditions[c.name] = 'not-applicable'
  const prerequisites: Record<string, PrerequisiteState> = {}
  for (const e of data.edges) if (e.prerequisiteKind !== 'step') prerequisites[e.prerequisite] = 'resolved'
  const r = deriveLane(CAMPAIGN, buildGraph(data as DependencyData), { steps: { ...steps, [CAMPAIGN]: obs }, conditions, prerequisites })
  return [r.lane, r.substatus].filter(Boolean).join(' · ')
}

test('P0-10: the campaign stays open until a person saves who needs special care; an empty list is a confirmed "nobody"', () => {
  const label = questionLabels(CAMPAIGN).decision
  assert.equal(label, 'People Needing Help')
  const f = fixture('demo')
  const at = f.snapshot.asOf
  // Unaddressed: the input is unsaved, and the campaign never reads Completed.
  assert.equal(f.mapping.specialCareConfirmed ?? null, null, 'the premise: nobody has confirmed the list')
  assert.deepEqual(unsavedInputsOf(CAMPAIGN, f.mapping), [label])
  assert.notEqual(readCampaign({ exists: true, complete: true, unsaved: [label!] }), 'Completed')
  assert.equal(readCampaign({ exists: true, complete: true, unsaved: [label!] }), 'Ready · Decision')
  assert.equal(readCampaign({ exists: true, complete: true }), 'Completed', 'the premise: nothing else keeps it open')
  // The picker's pre-ticked proposal (the detected pass) is not a confirmation.
  const detected = applyStepDecisions(f.mapping, { [CAMPAIGN]: { picked: ['someone'], at } }, 'detected')
  assert.deepEqual(unsavedInputsOf(CAMPAIGN, detected), [label])
  // A person's Save with nobody in it confirms "no special-care users" and clears the gate.
  const none = applyStepDecisions(f.mapping, { [CAMPAIGN]: { picked: [], at } })
  assert.deepEqual(none.specialCareConfirmed, [])
  assert.deepEqual(unsavedInputsOf(CAMPAIGN, none), [])
  // And a Save naming people confirms them.
  const some = applyStepDecisions(f.mapping, { [CAMPAIGN]: { picked: ['a', 'b'], at } })
  assert.deepEqual(some.specialCareConfirmed, ['a', 'b'])
  assert.deepEqual(unsavedInputsOf(CAMPAIGN, some), [])
  // The plan carries the gate on the step.
  const run = runFixture(f, {}, null, at)
  assert.deepEqual(run.steps.find((s) => s.id === CAMPAIGN)?.unsavedInputs, [label])
})
