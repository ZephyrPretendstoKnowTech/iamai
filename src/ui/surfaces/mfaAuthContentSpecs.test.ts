// Content review S3 (docs/content-review/SEGMENTS.md, MFA and authentication
// policy steps): one test per content spec (docs/content-review/specs/content-spec-*.md),
// each asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { app } from '../../content/content.ts'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'
import { authoredParts } from './authoredText.ts'

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
/** The blocks one channel draws, joined as the projection joins them (project.ts). */
const channel = (stepId: string, ids: string[]): string => ids.map((id) => packageOf(stepId).blocks[id].text).join('\n\n')
const HANDOFF = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
const CONFIRM = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'
const MFA_ALL = 's-goal-mfa-all-users'

/** Every step's body on a fixture, as the Plan composes it (contentReview.test.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const out = new Map<string, StepBody>()
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

const tilesOf = (b: StepBody) => [...b.readiness.tiles, ...b.readiness.satisfied]

test('s-goal-mfa-all-users: the bar names the Exclusions Group step, the threshold says what it measures, the unknown handoff reads plainly, Entra is one numbered procedure, and AI Info explains the policy', () => {
  // The readiness bar's sub-line while the scan's group waits on a Save.
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const waiting = bodiesOf(noExclusionsAnswer(fixture('mid')))
  assert.ok([...waiting.values()].some((b) => b.contract.whatToDo.text === CONFIRM), 'no step on the mid fixture waits on the group with the new words')
  // The threshold tile's collapsed value: the percentage and what it measures.
  const demo = bodiesOf(fixture('demo')).get(MFA_ALL)
  assert.ok(demo, 'the demo plan has the MFA step')
  const gate = tilesOf(demo).find((t) => t.key === 'gate')
  assert.ok(gate, 'the demo MFA step has no threshold tile')
  assert.match(String(gate.value), /^\d{1,3}% MFA-ready$/)
  // Where the scan could not work out who is held: the line, the link, and what follows it.
  const P = app.plan as unknown as Record<string, Record<string, string>>
  // The spec's "Some users may not…" is not applied: the Plan's words say people (footer.test.ts; BLOCKED.md).
  assert.equal(P.mfaReadinessHoldUnknown.mfa, "This scan could not work out who cannot meet this step's sign-in requirement yet.")
  assert.equal(P.mfaReadinessLinkUnknown.mfa, 'Check MFA Readiness →')
  assert.equal(P.mfaReadinessAfterUnknown.mfa, 'for per-person detail.')
  assert.match(HANDOFF, /UNKNOWN\.hold\[hold\.family\]/, 'the unknown line does not follow the hold family')
  assert.match(HANDOFF, /UNKNOWN\.link\[hold\.family\]/, 'the unknown link does not follow the hold family')
  assert.match(HANDOFF, /n === null && UNKNOWN\.after\[hold\.family\]/, 'the words after the link are not drawn')
  assert.equal(HANDOFF.match(/href=\{readinessStepHref\(step\.id\)\}/g)?.length, 1, 'the words are not one working link to the step’s MFA Readiness')
  // Entra: the three blocks a conditions correction draws.
  assert.ok(packageOf(MFA_ALL).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  const entra = channel(MFA_ALL, ['entra.correct-open', 'entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists and is enforced. The correction adds the exclusions group and aligns the conditions with the baseline.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    { kind: 'list', ordered: true, start: 1, items: [['Go to Entra admin center → Conditional Access → Policies.'], ['Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).']] },
    {
      kind: 'list', ordered: true, start: 3, items: [
        ['Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources: All resources. Under Exclude, Microsoft Intune Enrollment should be excluded (this prevents an enrollment loop).'],
        ['Conditions: no sign-in risk, no device platform, no location, no client app filter — leave all conditions blank except client apps (All client apps).'],
        ['Grant: Grant access → Require multifactor authentication.'],
      ],
    },
    { kind: 'list', ordered: true, start: 7, items: [['Save. Do not change the policy state (leave it On).'], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /mismatch modules|IAMAI-resolved|canonical/)
  const ai = packageOf(MFA_ALL).blocks['ai.correct'].text
  assert.match(ai, /^This is the foundational MFA policy: every user must present a second factor \(MFA\) at sign-in\. It's the single most impactful control in the baseline\.$/m)
  assert.match(ai, /^The policy is already enforced on your tenant\. The correction aligns its configuration with the baseline:\n— The exclusions group is added so emergency access accounts are exempt\.\n— Microsoft Intune Enrollment is excluded from target resources to prevent devices from failing enrollment because MFA fires during the enrollment flow\.\n— Conditions are cleaned to match the baseline's intent: no location, platform, or risk filters — MFA applies everywhere, unconditionally\.$/m)
  assert.match(ai, /^After this step, the MFA Registration Campaign step ensures every person has registered a phishing-resistant method\. Until that's done, the 33% threshold tile tracks progress\.$/m)
})
