// B10 P0-9 and P0-10: the MFA Registration Campaign offers its Implementation —
// the campaign's setup under Entra and the in-person walkthrough under AI Info,
// with MFA Readiness a link (S-MC-1, S-MC-3, archetype rule A3) — and stays open
// until a person saves who needs special care, nobody included (S-MC-2, A6, U28).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import data from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLane } from '../../actionability/lanes.ts'
import type { ConditionState, PrerequisiteState, StepObservation } from '../../actionability/lanes.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { SPECIAL_CARE_STEP_ID, questionLabels, unsavedInputsOf } from '../../roadmap/answers.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { laneViewOf, prerequisiteLabelFor, readinessBlockersOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { channelTabsOf, stepBodyOf } from './stepBody.ts'

const CAMPAIGN = SPECIAL_CARE_STEP_ID
const SECTIONS = readFileSync(new URL('./StepSections.tsx', import.meta.url), 'utf8')

function campaignBody() {
  const f = fixture('demo')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === CAMPAIGN)
  assert.ok(step, 'the campaign is on the demo plan')
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const reading = readings.get(CAMPAIGN)!
  return stepBodyOf(step, ctx, { lane: laneViewOf(reading, titleOf), blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
}

test('P0-9: the campaign offers Entra (the registration campaign setup) and AI Info (the in-person walkthrough)', () => {
  const b = campaignBody()
  // Every channel is a tab (content review D2); Entra and AI Info are the ones with content.
  assert.deepEqual(channelTabsOf(b.artifacts).map((t) => String(t.label)), ['Entra', 'PowerShell', 'AI Info', 'Email'])
  assert.deepEqual(channelTabsOf(b.artifacts.filter((a) => !a.unavailable)).map((t) => String(t.label)), ['Entra', 'PowerShell', 'AI Info', 'Email'])
  const entra = b.artifacts.find((a) => a.id === 'portal')!.text()
  // Editorial batch C: the method is the one the campaign's JSON targets (microsoftAuthenticator), and the snooze is the organization's value.
  for (const line of ['Registration campaign', 'Microsoft Authenticator', 'snooze']) assert.ok(entra.includes(line), `Entra is missing: ${line}`)
  const ai = b.artifacts.find((a) => a.id === 'ai')!.text()
  for (const line of ['registered methods', 'who needs help', 'tested workflow', 'registration-campaign']) assert.ok(ai.includes(line), `AI Info is missing: ${line}`)
  assert.doesNotMatch(entra, /Target: All users|State: Enabled/, 'preparation must not invent an approved campaign target')
  // S-MC-3: an in-app link in authored text renders as a link, and only an in-app one.
  assert.match(SECTIONS, /const APP_LINK = \/\^\\\[\(\[\^\\\]\]\+\)\\\]\\\(\(#\\\/\[\^\)\\s\]\*\)\\\)\$\//)
  assert.match(SECTIONS, /<a key=\{i\} className="inline-link" href=\{link\[2\]\}>/)
})

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
