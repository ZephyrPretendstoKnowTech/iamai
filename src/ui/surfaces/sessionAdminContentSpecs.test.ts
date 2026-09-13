// Content review S4 (docs/content-review/SEGMENTS.md, session and admin policy
// steps): one test per content spec (docs/content-review/specs/content-spec-*.md),
// each asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { CONTRACT } from './stepContract.ts'
import { authoredParts } from './authoredText.ts'

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
/** The blocks one channel draws, joined as the projection joins them (project.ts). */
const channel = (stepId: string, ids: string[]): string => ids.map((id) => packageOf(stepId).blocks[id].text).join('\n\n')
type ContentStepWords = { id: string; why: string; doneEnd?: string; doneWhen?: string[]; decision?: { help?: string; options?: string[] } }
const stepWords = (id: string): ContentStepWords => (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as ContentStepWords[]).find((s) => s.id === id)!
const CONFIRM = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'

test('s-goal-admin-session: Why is two whole sentences, Entra is one numbered procedure naming the policy, and AI Info explains the session limit', () => {
  const SESSION = 's-goal-admin-session'
  assert.equal(stepWords('admin-session').why, 'A stolen admin session stays useful as long as it lasts. A short session limits the damage: an attacker who steals the token has minutes, not hours.')
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.ok(packageOf(SESSION).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(SESSION, ['entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists and is enforced. The correction adds the exclusions group.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).'],
        ['Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.'],
        ["Verify the session controls match the baseline: Sign-in frequency enabled, set to the baseline's interval. Persistent browser session: set to Never persistent."],
      ],
    },
    { kind: 'list', ordered: true, start: 5, items: [['Save. Do not change the policy state (leave it On).'], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI's canonical target|canonical|stable tenant ID/)
  const ai = packageOf(SESSION).blocks['ai.correct'].text
  assert.match(ai, /^This policy shortens how long an admin's session stays valid\. After the sign-in frequency interval, the admin is prompted to re-authenticate\.$/m)
  assert.match(ai, /^This protects against token theft: even if an attacker steals an admin's session token, it expires quickly\. Combined with phishing-resistant MFA, re-authentication requires a passkey the attacker doesn't have\.$/m)
  assert.match(ai, /^The correction on this step adds the exclusions group so emergency access accounts are not affected by the session limit\.$/m)
  assert.match(ai, /^The persistent browser session control ensures admin sessions are not remembered across browser closures\.$/m)
  // Done when is unchanged.
  assert.equal(stepWords('admin-session').doneEnd, "The policy is enforced in {tenant} with the baseline's session controls (sign-in frequency and persistent browser session), and the exclusions group is applied.")
})
