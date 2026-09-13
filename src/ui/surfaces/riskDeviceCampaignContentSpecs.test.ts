// Content review S5 (docs/content-review/SEGMENTS.md, risk, device and campaign
// steps): one test per content spec (docs/content-review/specs/content-spec-*.md),
// each asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
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
type ContentStepWords = { id: string; why: string; doneEnd?: string; doneWhen?: string[]; decision?: { label?: string; help?: string; text?: string; tileValue?: string } }
const stepWords = (id: string): ContentStepWords => (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as ContentStepWords[]).find((s) => s.id === id)!
const CONFIRM = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'

/** One step's body on a fixture, as the Plan composes it (sessionAdminContentSpecs.test.ts). */
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

test('s-goal-sign-in-risk-medium: Entra is one numbered portal procedure naming the exclusions group step, and AI Info explains the policy for a tech', () => {
  const MEDIUM = 's-goal-sign-in-risk-medium'
  // A P2 tenant with nothing deployed draws the create state.
  const b = bodyOf('huge', MEDIUM)
  const entra = drawn(b, 'portal')
  assert.deepEqual(authoredParts(entra), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: Core - Require - Medium sign-in risk.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources: All resources.'],
        ['Conditions → Sign-in risk: check Medium only.'],
        ['Grant → Grant access → Require multifactor authentication.'],
        ['Session: leave empty (no session controls).'],
        ['Enable policy: Report-only.'],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.doesNotMatch(entra, /canonical|retained baseline member/)
  assert.equal(drawn(b, 'ai'), [
    'This policy requires MFA when Microsoft detects a medium-risk sign-in — for example, a sign-in from an unfamiliar location, a new device, or credentials found in a leaked database.',
    'It starts in Report-only so you can observe which sign-ins would be challenged without blocking anyone. After the observation window, IAMAI will prompt you to enforce it.',
    'The exclusions group is excluded so emergency access accounts are never blocked by this policy.',
  ].join('\n\n'))
  // The PowerShell script and the JSON body are unchanged, and the shared readiness sentence stays (BLOCKED.md).
  assert.match(packageOf(MEDIUM).blocks['powershell.run'].text, /^# IAMAI compact implementation script — Challenge Medium-Risk Sign-ins$/m)
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  // Why and Done when are unchanged.
  const words = stepWords('sign-in-risk-medium')
  assert.equal(words.why, 'Medium risk is where most real attacks land: a new country, a new device, a password that appears on a list.')
  assert.equal(words.doneEnd, "The policy is enforced in {tenant} at the medium-risk threshold and matches the baseline's target configuration, with the exclusions group applied.")
})

test('s-goal-sign-in-risk: Entra is one numbered portal procedure naming the strength, and AI Info explains why high risk needs the strength and Every time', () => {
  const HIGH = 's-goal-sign-in-risk'
  const STRENGTH = '{{authStrength.target.displayName}}'
  assert.deepEqual(authoredParts(packageOf(HIGH).blocks['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group.'],
        ['Target resources: All resources.'],
        ['Conditions → Sign-in risk: check High only (not Medium).'],
        [`Grant → Grant access → Require authentication strength → select "${STRENGTH}" (the strength you created in the Authentication Strength step).`],
        ['Session → Sign-in frequency: Every time.'],
        ['Enable policy: Report-only.'],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.equal(packageOf(HIGH).blocks['ai.create'].text, [
    'This policy responds to high-risk sign-ins detected by Microsoft Entra ID Protection. High risk means Microsoft is fairly confident the sign-in is compromised — for example, credentials confirmed in a breach database, or traffic from a known attack infrastructure.',
    `Unlike the medium-risk policy (which requires standard MFA), this one requires the authentication strength "${STRENGTH}" — only phishing-resistant methods. The reasoning: if the risk is high, a phished code or push approval might be exactly how the attacker got in.`,
    `The "Every time" sign-in frequency forces re-authentication on every high-risk sign-in, even if the user has a valid session. This ensures the attacker can't ride an existing session.`,
    'The exclusions group ensures emergency access accounts are not blocked during a high-risk event.',
  ].join('\n\n') + '\n')
  // Opened on a P2 tenant with nothing deployed, both channels draw with the tenant's names.
  const b = bodyOf('huge', HIGH)
  const entra = drawn(b, 'portal')
  assert.match(entra, /^2\. Name: Core - Require - Sign-in risk\.$/m)
  assert.match(entra, /^6\. Grant → Grant access → Require authentication strength → select "[^"{}]+" \(the strength you created in the Authentication Strength step\)\.$/m)
  assert.doesNotMatch(entra, /canonical|\{\{/)
  assert.match(drawn(b, 'ai'), /^Unlike the medium-risk policy \(which requires standard MFA\), this one requires the authentication strength "[^"{}]+"/m)
  // The shared readiness sentence stays (BLOCKED.md); Why and Done when are unchanged.
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const words = stepWords('sign-in-risk')
  assert.equal(words.why, 'Microsoft sees leaked-credential lists and impossible travel before you do; this lets that signal act.')
  assert.equal(words.doneEnd, "The policy is enforced in {tenant} at the high-risk threshold, with the baseline's authentication strength as the grant control and the exclusions group applied.")
})
