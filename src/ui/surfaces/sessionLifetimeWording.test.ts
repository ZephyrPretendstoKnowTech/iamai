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
/**
 * A sign-in frequency written out as a number. The pinned target carries the
 * interval; the step and its package point at the target everywhere, so a re-pin
 * cannot leave a stale number behind (docs/plans/risk-and-sessions-spec.md,
 * "Limit How Long Sessions Last takes its interval from the target").
 */
const INTERVAL = /\b\d+[- ]hours?\b/i

test('session-lifetime: every projected explanation in every state describes the browser policy alone', () => {
  for (const [state, bindings] of STATES) {
    const p = projectImplementation(PKG, state, bindings)
    assert.equal(p.hold, null, `${state}: ${JSON.stringify(p.hold)}`)
    const ai = p.channels.find((c) => c.channel === 'aiInfo')?.text ?? ''
    assert.ok(ai.length > 0, `${state}: no AI Info drawn`)
    // The whole briefing, not its first line: the target is the browser policy and says there is no second one.
    // The target names only the exclusions the resolved target has (consolidated batch item 2), never a mandatory shared-device set.
    // Editorial batch C: the Policy A/B framing is gone; the intended policy is stated alone, and every state says it is the only one.
    // Respond to Risk and Limit Sessions (docs/plans/risk-and-sessions-spec.md): the
    // browser-only condition goes through its Configure toggle — at No the interval
    // would reach every desktop and mobile app — and the interval itself is the
    // resolved target's, never restated here, so a re-pin cannot leave a stale number
    // (concept-conditional-access-conditions and howto-conditional-access-session-lifetime,
    // checked 2026-09-20).
    assert.match(ai, /All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; All resources; Client apps set through Configure: Yes, then Browser; Sign-in frequency as the intended target sets it \(periodic reauthentication\); Persistent browser session Never persistent; no grant\./, state)
    assert.doesNotMatch(ai, /shared-device exclusions|group\/shared-device/, state)
    assert.match(ai, /The baseline has one session policy for this step/, state)
    // A state that writes settings also says not to add a companion.
    if (state === 'missing' || state === 'partial') assert.match(ai, /Do not add a companion policy, conditions or exclusions that the baseline does not contain/, state)
    // Every channel but the script, whose retained modes are execution and unchanged in this pass.
    for (const c of p.channels.filter((x) => x.channel !== 'powershell')) {
      assert.doesNotMatch(c.text, COMPANION, `${state}/${c.channel}: ${c.text.match(COMPANION)?.[0]}`)
      // Only the resolved target carries the interval, so no channel writes one out.
      assert.doesNotMatch(c.text, INTERVAL, `${state}/${c.channel}: ${c.text.match(INTERVAL)?.[0]}`)
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
  // Respond to Risk and Limit Sessions: the notice no longer writes the interval out either.
  assert.match(email.text, /We plan to change browser sign-in to the new frequency and disable persistent browser sign-in\./)
  assert.doesNotMatch(email.text, INTERVAL)
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
  // The A/B pair belongs to a goal the baseline really implements with two policies
  // (stepVars.ts pairBaselineNames); this one is a single policy, so neither the
  // labels nor the pair's name slots may appear — the reviewer reference said "One
  // policy" and then labelled it "Policy A:", binding a name this step never gets.
  assert.doesNotMatch(own, /\{policyName[AB]\}|Policy A:|"policyName[AB]"/, own.match(/\{policyName[AB]\}|Policy A:|"policyName[AB]"/)?.[0] ?? '')
  // Respond to Risk and Limit Sessions: the end state is everyone's browser session and
  // nothing else, and it takes the interval from the baseline instead of naming one.
  assert.equal(step.doneEnd, "Nobody's browser session at {tenant} survives closing the browser, and every one of them authenticates again on the interval the baseline sets, with the exclusions group applied.")
  // The interval is a slot, never a number the entry writes out: only `example`
  // (sample data) and the resolved target carry a value.
  const authored = JSON.stringify({ ...step, example: undefined })
  assert.doesNotMatch(authored, INTERVAL, authored.match(INTERVAL)?.[0] ?? '')
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
      assert.doesNotMatch(words, /Policy A:|Policy B:/, `${name}/${s.id}`)
      rendered += 1
    }
  }
  assert.ok(rendered > 0, 'no sample plan carries the session-lifetime step: the rendered check proves nothing')
})

test('the two session steps no longer share one Completion Criteria: each says whose sessions it is about, and that the other exists', () => {
  // docs/plans/step-redundancy-analysis.md finding 1, the most likely "why are
  // there two of these?" moment in the product: Shorten Admin Sessions and Limit
  // How Long Sessions Last sat 40 rows apart, under two headings, with
  // byte-identical Completion Criteria. The pinned baseline defines two policies
  // — the first scoped to the directory roles it names, the second to all users,
  // both browser-only and never-persistent — so both steps stay, and each one's
  // words say which.
  const words = (id: string): string[] => ((content.steps as { id: string; doneWhen?: string[] }[]).find((x) => x.id === id)?.doneWhen ?? [])
  const admin = words('admin-session')
  const everyone = words('session-lifetime')
  assert.ok(admin.length > 0 && everyone.length > 0)
  assert.equal(admin.some((l) => everyone.includes(l)), false, 'a Completion Criteria line is shared word for word')
  assert.match(admin[0], /for the administrator roles it names/)
  assert.match(everyone[0], /for all users in the browser/)
  // Each names the other, because an administrator is inside both and gets the stricter.
  assert.ok(admin.some((l) => /Limit How Long Sessions Last/.test(l) && /shorter sign-in frequency/.test(l)), admin.join('\n'))
  assert.ok(everyone.some((l) => /Shorten Admin Sessions/.test(l) && /shorter frequency/.test(l)), everyone.join('\n'))
})
