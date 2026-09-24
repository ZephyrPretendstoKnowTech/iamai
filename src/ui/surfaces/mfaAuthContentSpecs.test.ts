// Content review S3 (docs/content-review/SEGMENTS.md, MFA and authentication
// policy steps). The procedures' words are pinned by the rendered step snapshots
// (src/testing/stepSnapshots.test.ts); what is asserted here is the safety each
// correction must carry, and what a tile may claim about records IAMAI never read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'
import { fillText } from '../../content/render.ts'

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
/** The blocks one channel draws, joined as the projection joins them (project.ts). */
const channel = (stepId: string, ids: string[]): string => ids.map((id) => packageOf(stepId).blocks[id].text).join('\n\n')
// The confirmation names the exclusions step by its real title. "the Exclusions Group
// step" named no step (quality audit 2026-09-20 §3, `fixConfirmExclusions`), so the
// sentence carries a {step} slot the contract fills with that step's own title.
const EXCLUSIONS_TITLE = 'Configure Emergency Exclusions'
const CONFIRM = `Complete ${EXCLUSIONS_TITLE} first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.`

/** Every step's body on a fixture, as the Plan composes it (contentReview.test.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const out = new Map<string, StepBody>()
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const lane = laneViewFor(step, { readings, titleOf })
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

const tilesOf = (b: StepBody) => [...b.readiness.tiles, ...b.readiness.satisfied]

test('every correction procedure keeps the state it finds, says what a save does to a policy that is On, names the exclusions it removes and the exclusions group; a policy waiting on that group asks for its confirmation', () => {
  // The readiness bar's sub-line while the scan's group waits on a Save.
  assert.equal(fillText(CONTRACT.fixConfirmExclusions, { step: EXCLUSIONS_TITLE }), CONFIRM)
  const waiting = bodiesOf(noExclusionsAnswer(fixture('mid')))
  assert.ok([...waiting.values()].some((b) => b.contract.whatToDo.text === CONFIRM), 'no step on the mid fixture waits on the group with the confirmation')
  const corrections: [string, string[]][] = [
    ['s-goal-mfa-all-users', ['entra.correct-open', 'entra.correct-conditions', 'entra.correct-verify']],
    ['s-goal-admins-phishing-resistant', ['entra.correct-open', 'entra.correct-conditions', 'entra.correct-verify']],
    ['s-goal-block-auth-transfer', ['entra.correct-conditions', 'entra.correct-verify']],
    ['s-goal-block-device-code', ['entra.correct-conditions', 'entra.correct-verify']],
    ['s-goal-guests-mfa', ['entra.correct-pair']],
  ]
  for (const [id, blocks] of corrections) {
    const entra = channel(id, blocks)
    // Cycle 2 (C02): "leave it On" was wrong for a Report-only policy; the correction keeps whatever state the policy has.
    assert.match(entra, /Keep the policy's current state\.|Leave \*\*Enable policy\*\* as it is/, id)
    assert.doesNotMatch(entra, /Enable policy\**\s*(?::|to)\s*\**(?:On|Off)\b|\b(?:turn|switch|set) (?:it|the policy) (?:on|off)\b/i, id)
    // Cycle 3 (review 2): and says what saving does to a policy that is On.
    assert.match(entra, /\bif (?:it|the policy|that policy) is On, (?:the changed rule can affect access after you save|it applies to them as soon as you save)/i, id)
    // Cycle 6 (review 5 queue 1): the Save names the exclusions the update removes.
    assert.match(entra, /This change removes \{\{(?:policy|policies\.guests\.(?:strong|mixed))\.current\.removedExclusions\}\}/, id)
    // The exclusion is the group the operator confirmed, never an account by name.
    assert.match(entra, /exclusions group/, id)
  }
  // The check after the change keeps the way back in view.
  assert.match(channel('s-goal-mfa-all-users', ['entra.correct-verify']), /emergency access still works/)
})

test('s-goal-block-legacy-auth: the mail-sending question draws no card on the step, whether or not IAMAI holds the sign-in records', () => {
  // The question is answered on Confirm What You Use, and the step waits there
  // (walk list 4.x item 6). The card it drew said "A quiet sign-in history does
  // not establish…" where the records were read, and "…no sign-in records could
  // be read…" on hostile, the one tenant that reached it (item 37).
  const LEGACY = 's-goal-block-legacy-auth'
  for (const name of ['hostile', 'mid'] as const) {
    const body = bodiesOf(fixture(name)).get(LEGACY)
    assert.ok(body, `the ${name} plan has the legacy authentication step`)
    assert.equal(tilesOf(body).some((t) => t.key.startsWith('unsaved:')), false, `${name}: the mail-sending question still draws a card`)
    assert.doesNotMatch(tilesOf(body).map((t) => String(t.note)).join('\n'), /quiet sign-in history|no sign-in records could be read/)
  }
})
