// Content corrections pass (release review R01): "Limit How Long Sessions Last"
// creates, corrects, reviews and enables the pinned browser policy alone, yet its
// AI Info still described an unmanaged-device Policy B, told the reader not to
// collapse "the two policies", and Done when required the policy "with its pair".
// These read the whole rendered explanation — every projected channel in every
// state, the readiness and troubleshooting models, and the Plan's own Why, Done
// when, comms and export text — not only the corrected opening sentence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from '../../content/implementation/protocol.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import { projectImplementation } from '../../content/implementation/project.ts'
import content from '../../../docs/design/content.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'

const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages['s-goal-session-lifetime']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const base = (): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policies.session.browser.target.displayName': 'Sample - browser sessions',
  'policies.session.browser.current.id': ID(3),
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.excludeUsers': [ID(2)],
})
const STATES: [PackageState, Record<string, unknown>][] = [
  ['missing', { ...base(), 'policies.session.browser.current.id': undefined }],
  ['partial', { ...base(), 'policies.session.semanticMismatches': ['sessionControls'], [CHANGED_FIELDS_BINDING]: ['sessionControls.signInFrequency'], 'policies.session.browser.current.changedFields': ['sessionControls.signInFrequency'], 'policies.session.browser.operation': 'update' }],
  ['reportOnly', base()],
  ['readyToEnforce', base()],
]

/** Wording that describes a second, unmanaged-device session policy as part of this step. */
const COMPANION = /Policy B:|two-policy|two policies|collapse|with its pair|this pair|both (component )?policies|either component|9-hour|9 hours|12\/9|unmanaged-device component|unmanaged component|every app\b/i

test('session-lifetime: every projected explanation in every state describes the browser policy alone', () => {
  for (const [state, bindings] of STATES) {
    const p = projectImplementation(PKG, state, bindings)
    assert.equal(p.hold, null, `${state}: ${JSON.stringify(p.hold)}`)
    const ai = p.channels.find((c) => c.channel === 'aiInfo')?.text ?? ''
    assert.ok(ai.length > 0, `${state}: no AI Info drawn`)
    // The whole briefing, not its first line: the target is the browser policy and says there is no second one.
    // The target names only the exclusions the resolved target has (consolidated batch item 2), never a mandatory shared-device set.
    // Editorial batch C: the Policy A/B framing is gone; the intended policy is stated alone, and every state says it is the only one.
    assert.match(ai, /All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; All resources; Client apps Browser; Sign-in frequency 12 hours/, state)
    assert.doesNotMatch(ai, /shared-device exclusions|group\/shared-device/, state)
    assert.match(ai, /The baseline has one session policy for this step/, state)
    // A state that writes settings also says not to add a companion.
    if (state === 'missing' || state === 'partial') assert.match(ai, /Do not add a companion policy, conditions or exclusions that the baseline does not contain/, state)
    // Every channel but the script, whose retained modes are execution and unchanged in this pass.
    for (const c of p.channels.filter((x) => x.channel !== 'powershell')) {
      assert.doesNotMatch(c.text, COMPANION, `${state}/${c.channel}: ${c.text.match(COMPANION)?.[0]}`)
    }
    // Editorial batch C: a correction keeps the policy's state, so "do not turn it On until…" is gone.
    if (state === 'partial') {
      const entra = p.channels.find((c) => c.channel === 'entra')?.text ?? ''
      assert.match(entra, /read the policy back by its policy ID, and rescan IAMAI\./)
      assert.match(entra, /If it is On, the changed rule can affect access after you save\./)
      assert.doesNotMatch(entra, /Do not turn it On until/)
    }
  }
})

test('session-lifetime: the pre-enforcement Email describes browser sessions for everyone, and the readiness and troubleshooting models check one policy', () => {
  const email = projectImplementation(PKG, 'readyToEnforce', base()).channels.find((c) => c.channel === 'email')
  assert.ok(email, 'the pre-enforcement Email is not drawn')
  assert.equal(email.communication?.audience, 'all-users')
  // Editorial batch C: the register notice, without the unverified claim about apps outside the browser.
  assert.match(email.text, /We plan to change browser sign-in to a 12-hour frequency and disable persistent browser sign-in\./)
  assert.doesNotMatch(email.text, /Apps outside the browser are not affected/)
  assert.doesNotMatch(email.text, COMPANION)
  assert.doesNotMatch(email.text, /IT has separately checked/)
  for (const id of ['readiness.model', 'troubleshooting.model']) {
    const text = PKG.blocks[id].text
    assert.doesNotMatch(text, COMPANION, `${id}: ${text.match(COMPANION)?.[0]}`)
    assert.doesNotMatch(text, /companion|device\.isCompliant/, id)
  }
  // The compiled readiness model withholds its tiles (a structural limitation the compiler records),
  // so the authored verification tiles and the package's own spec are read at the source.
  const source = readFileSync('docs/implementation-content/s-goal-session-lifetime/CONTENT.md', 'utf8')
  const models = source.slice(source.indexOf('@@IAMAI-BEGIN {"id":"readiness.model"'))
  assert.match(models, /"gate": "The browser policy matches the intended settings, is in Report-only/)
  assert.doesNotMatch(models, COMPANION, models.match(COMPANION)?.[0] ?? '')
  assert.doesNotMatch(models, /companion|device\.isCompliant/)
  const spec = readFileSync('docs/implementation-content/s-goal-session-lifetime/STEP.md', 'utf8')
  assert.doesNotMatch(spec, COMPANION, spec.match(COMPANION)?.[0] ?? '')
})

test("session-lifetime: the Plan's own Why, Done when, comms and export text name no second policy", () => {
  const step = (content as unknown as { steps: Record<string, unknown>[] }).steps.find((s) => s.id === 'session-lifetime')
  assert.ok(step, 'the content step is gone')
  // The whole content entry: Why, who, Done when, comms, the manager and help-desk notes, and the reference steps.
  const own = JSON.stringify(step)
  assert.doesNotMatch(own, COMPANION, own.match(COMPANION)?.[0] ?? '')
  assert.doesNotMatch(own, /\{policyNameB\}/)
  assert.match(String(step.doneEnd), /^The policy is enforced in \{tenant\}: the browser policy, carrying the baseline's session control values \(12-hour sign-in frequency and never-persistent browser sessions\)/)
  // As the Plan renders them: every word of the contract and the export, on every sample plan that carries the step.
  let rendered = 0
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const run = runFixture(f, {}, null, f.snapshot.asOf)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as unknown as StepVarContext
    // The plan's step is the all-users no-persistence goal; its content entry is session-lifetime (stepTitle.ts alias).
    for (const s of run.steps.filter((x) => /all-users-no-persistence|session-lifetime/.test(x.id) && x.doesntApply == null)) {
      const words = JSON.stringify(stepContract(s, ctx)) + JSON.stringify(stepExportView(s, ctx))
      assert.doesNotMatch(words, COMPANION, `${name}/${s.id}: ${words.match(COMPANION)?.[0]}`)
      rendered += 1
    }
  }
  assert.ok(rendered > 0, 'no sample plan carries the session-lifetime step: the rendered check proves nothing')
})
