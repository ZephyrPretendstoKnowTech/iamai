// Content review S4 (docs/content-review/SEGMENTS.md, session and admin policy
// steps). The reviewed words are pinned by docs/qa/step-snapshots; what stays
// here is the safety instruction a correction carries: it keeps the policy's
// state, and says what saving does to a policy that is On.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
// Cycle 6 (review 5 queue 1): a correction's Save item and AI Info also carry the line naming
// the exclusions the update removes, omitted when it removes none ([omit this line when unavailable]).
const REMOVED = "This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]"
// Editorial batch C (SHARED-COPY-AND-RULES.md, correction preserving state).
const KEEP_STATE = "Keep the policy's current state. If it is On, the changed rule can affect access after you save."

test('a correction keeps the policy state, says what saving does to a policy that is On, and names the exclusions it removes', () => {
  for (const id of ['s-goal-admin-session', 's-goal-block-legacy-auth']) {
    const verify = packageOf(id).blocks['entra.correct-verify'].text
    // Cycle 2 (C02): "leave it On" was wrong for a Report-only policy; the correction keeps whatever state the policy has.
    assert.match(verify, /\*\*Enable policy\*\* (unchanged|as it is)/, `${id}: the Save item changes the policy's state`)
    assert.ok(verify.includes(REMOVED), `${id}: the Save item does not name the exclusions it removes`)
    assert.ok(packageOf(id).blocks['ai.correct'].text.includes(KEEP_STATE), `${id}: AI Info does not keep the state`)
  }
  // Token protection's correction to Report-only is the one state move a correction offers.
  assert.ok(packageOf('s-goal-token-protection').blocks['ai.correct'].text.includes(KEEP_STATE))
  assert.match(packageOf('s-goal-token-protection').blocks['entra.correct.lifecycle.report-only'].text, /Report-only/)
})
