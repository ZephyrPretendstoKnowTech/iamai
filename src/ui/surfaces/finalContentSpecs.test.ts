// Content review S7 (docs/content-review/SEGMENTS.md, final steps and cleanup):
// one test per content spec (docs/content-review/specs/content-spec-*.md), each
// asserting what the opened step or Cleanup row now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'

type ContentStepWords = { id: string; doneEnd?: string }
const stepWords = (id: string): ContentStepWords => (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as ContentStepWords[]).find((s) => s.id === id)!

/** One step's body on a fixture, as the Plan composes it (riskDeviceCampaignContentSpecs.test.ts). */
function bodyOf(name: FixtureName, stepId: string): StepBody {
  const f = fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const step = r.steps.find((s) => s.id === stepId)
  assert.ok(step, `the ${name} plan has ${stepId}`)
  const reading = readings.get(step.id)
  const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  return stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
}
/** The text one channel tab draws. */
const drawn = (b: StepBody, id: string): string => b.artifacts.find((a) => a.id === id)!.text()

test('s-goal-user-risk-medium: Entra is one numbered portal procedure with the separate-policy note, AI Info explains the policy, and Done when drops the tenant name', () => {
  const b = bodyOf('huge', 's-goal-user-risk-medium')
  assert.equal(drawn(b, 'portal'), [
    '1. In Entra admin center → Protection → Conditional Access → Policies, click New policy.',
    '2. Name: Core - Require - Password change for medium-risk users.',
    '3. Under Users → Include, select All users.',
    '4. Under Users → Exclude, add the exclusions group from the Create or Correct Exclusions Group step, and exclude All guest and external users.',
    '5. Under Target resources, select All resources.',
    '6. Under Conditions → User risk, select Medium.',
    '7. Under Grant, select Grant access → Require multifactor authentication AND Require password change. (Both must be satisfied — use the AND operator.)',
    '8. Leave Session controls empty.',
    '9. Set Enable policy to Report-only.',
    '10. Click Save, then rescan in IAMAI.',
    '',
    "Note: This policy is separate from the high-risk user policy (which triggers at High risk). Do not combine them or lower the high-risk policy's threshold — keep both policies active at their respective risk levels.",
  ].join('\n'))
  assert.equal(drawn(b, 'ai'), [
    'This policy forces a password change (with MFA) when Entra ID Protection flags a user at medium risk. It applies to all users except the exclusions group and guest/external users, covers all resources, and starts in Report-only.',
    '',
    'Review the proposed policy to confirm: it targets medium risk only (not high — that has its own policy), requires both MFA and password change (AND, not OR), excludes guests, and has no session controls. Do not combine this with the high-risk policy or add automatic risk remediation — the password change itself clears the risk.',
  ].join('\n'))
  assert.equal(stepWords('s-goal-user-risk-medium').doneEnd, 'The policy is enforced at the medium-risk threshold, requiring MFA and password change as remediation, with the exclusions group applied and guest/external users excluded.')
})
