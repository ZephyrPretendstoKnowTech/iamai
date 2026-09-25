// The implementation-content pilot: s-goal-device-registration-mfa, end to end,
// against the runtime contract (README.md).
//
// Package ingestion (protocol.ts), state projection, Partial composition from the
// engine's semantic facts, the enforcement gate and owner confirmations,
// bindings, readiness, troubleshooting and the source date (project.ts), and the
// runtime adapter that hands IAMAI's state to the package (stepPackage.ts). The
// fixture supplies state, bindings and confirmations; every word of content is
// read from the package itself.
import { test } from 'node:test'
import { EXCLUSIONS_RECORD_KEY } from '../../mapping/safetyChoice.ts'
import { RUNTIME_META_KEYS } from './library.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANGED_FIELDS_BINDING, PackageError, compilePackage, parseBlocks, validatePackage } from './protocol.ts'
import type { CompiledPackage, Prerequisite } from './protocol.ts'
import { OUTPUT_ORDER, PACKAGE_STATES, packageReadiness, prerequisiteBasis, prerequisiteStatus, projectImplementation, sourceUpdatedOn, troubleshootingFor } from './project.ts'
import type { PackageState } from './project.ts'
import registry from './registry.generated.json' with { type: 'json' }
import { PILOT_IDS, PILOT_PIN, PILOT_PREREQUISITES, PILOT_STEP_ID, pilotBindings, pilotRuntime, pilotStepAt } from '../../testing/pilotFixture.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { CONTRACT, readinessOf, stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { BASELINE_COMMIT, REGISTERED_PACKAGE_STEP_IDS, mergeReadiness, packageForEntry, packageBindings, packageRuntime, packageSourceLine, packageStateOf } from '../../ui/surfaces/stepPackage.ts'
import { fillText } from '../render.ts'
import { absoluteDate } from '../../copy/dates.ts'

/** The mode ValidateSet of a projected script, for reading which modes it still declares. */
const SET_RE = new RegExp("ValidateSet" + String.fromCharCode(92) + "(([^)]*)" + String.fromCharCode(92) + ")")

const DIR = `docs/implementation-content/${PILOT_STEP_ID}`
const read = (p: string): string => readFileSync(p, 'utf8')
const PKG: CompiledPackage = compilePackage(read(`${DIR}/META.json`), read(`${DIR}/CONTENT.md`))
const ALL = pilotRuntime()
const project = (state: PackageState, over: Record<string, unknown> = {}, runtime = ALL) => projectImplementation(PKG, state, pilotBindings(state, over), runtime)
const channelsOf = (state: PackageState, over: Record<string, unknown> = {}): string[] => project(state, over).channels.map((c) => c.channel)
const artifact = (state: PackageState, channel: string, over: Record<string, unknown> = {}) => project(state, over).channels.find((c) => c.channel === channel)!
const authored = (id: string): string => PKG.blocks[id].text.replace(/\s+$/, '')

// ------------------------------------------------------------ package ingestion

test('the pilot package compiles under the strict contract, and the registry holds it exactly as compiled against the baseline pin the build carries', () => {
  // the pilot package compiles under the strict contract: every projected block, invocation, condition and model is sound
  {
    assert.equal(PKG.meta.stepId, PILOT_STEP_ID)
    assert.deepEqual(validatePackage(PKG), [])
    assert.equal(Object.keys(PKG.blocks).length, 24)
    assert.deepEqual(Object.keys(PKG.meta.projection).sort(), [...PACKAGE_STATES].sort())
  }
  // the registry holds the pilot exactly as compiled, authored against the baseline pin the build carries
  {
    const packages = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
    // The registry carries the META fields the product reads, and nothing of the author's evidence besides (library.ts RUNTIME_META_KEYS).
    const shipped = { meta: Object.fromEntries(RUNTIME_META_KEYS.filter((k) => PKG.meta[k] !== undefined).map((k) => [k, PKG.meta[k]])), blocks: PKG.blocks }
    assert.deepEqual(packages[PILOT_STEP_ID], JSON.parse(JSON.stringify(shipped)), 'registry.generated.json drifted from its sources: run scripts/compile-implementation-content.mjs --registry')
    assert.ok(REGISTERED_PACKAGE_STEP_IDS.includes(PILOT_STEP_ID))
    // Re-authored against the build's pin on 2026-09-11 (it named 8461e0f2 before).
    assert.equal(BASELINE_COMMIT, JSON.parse(read('baselines/jhope188-conditionalaccesspolicies.pinned.json')).commit)
    assert.equal(PILOT_PIN, BASELINE_COMMIT)
    assert.equal(packageForEntry({ id: PILOT_STEP_ID, goalId: 'device-registration-mfa' }), packages[PILOT_STEP_ID])
  }
})

test('a duplicate, nested, unterminated or unknown block fails, and so does an unsupported channel', () => {
  const block = (id: string, channel = 'entra', states = ['missing']) => `@@IAMAI-BEGIN ${JSON.stringify({ id, channel, states, format: 'markdown' })}\nText.\n@@IAMAI-END\n`
  assert.throws(() => parseBlocks(block('entra.create') + block('entra.create')), PackageError)
  assert.throws(() => parseBlocks(`@@IAMAI-BEGIN {"id":"a","channel":"entra"}\n@@IAMAI-BEGIN {"id":"b","channel":"entra"}\n@@IAMAI-END\n@@IAMAI-END\n`), PackageError)
  assert.throws(() => parseBlocks(`@@IAMAI-BEGIN {"id":"a","channel":"entra"}\nText.\n`), PackageError)
  assert.throws(() => parseBlocks(`@@IAMAI-BEGIN {not json}\n@@IAMAI-END\n`), PackageError)
  const meta = JSON.parse(read(`${DIR}/META.json`)) as { projection: { missing: { entra: string[] } } }
  meta.projection.missing.entra = ['entra.nope']
  assert.throws(() => compilePackage(JSON.stringify(meta), read(`${DIR}/CONTENT.md`)), /missing block entra\.nope/)
  const odd = validatePackage({ meta: { stepId: 'x', projection: {} }, blocks: parseBlocks(block('fax.send', 'fax')) })
  assert.ok(odd.some((e) => /unsupported channel fax/.test(e)), odd.join('\n'))
  const badKey = validatePackage({ meta: { stepId: 'x', projection: { missing: { fax: ['entra.create'] } } }, blocks: parseBlocks(block('entra.create')) })
  assert.ok(badKey.some((e) => /unsupported key fax/.test(e)), badKey.join('\n'))
})

// ------------------------------------------------------------------ projection

test('each state projects exactly the channels META.json names for it', () => {
  assert.deepEqual(channelsOf('missing'), ['entra', 'powershell', 'json', 'aiInfo'])
  assert.deepEqual(channelsOf('partial'), ['entra', 'powershell', 'json', 'aiInfo'])
  assert.deepEqual(channelsOf('reportOnly'), ['entra', 'powershell', 'aiInfo'])
  assert.deepEqual(channelsOf('readyToEnforce'), ['entra', 'powershell', 'json', 'aiInfo', 'email'])
  for (const state of ['inPlace', 'blocked', 'needsDecision', 'sourceConflict', 'notLicensed'] as const) {
    assert.deepEqual(channelsOf(state), [], `${state} manufactures an implementation`)
  }
  assert.deepEqual([...OUTPUT_ORDER], ['entra', 'powershell', 'json', 'aiInfo', 'email'])
})

test('Ready to enforce projects all five channels, and the script is runnable as projected', () => {
  const p = project('readyToEnforce')
  assert.equal(p.hold, null)
  const by = Object.fromEntries(p.channels.map((c) => [c.channel, c]))
  assert.deepEqual(by.entra.blocks, ['entra.enforce'])
  assert.equal(by.entra.text, authored('entra.enforce'))
  // The script, defined once, and the call its invocation makes with IAMAI's values
  // and the switches for the checks that are satisfied (content/implementation/invocation.ts).
  assert.deepEqual(by.powershell.blocks, ['powershell.run'])
  assert.deepEqual(by.powershell.runs, [{ mode: 'Enforce', corrections: [] }])
  assert.ok(by.powershell.text.startsWith('function Invoke-IAMAIStep {\n# IAMAI compact implementation script'))
  // Cycle 6 (review 5 queue 1): the script's line naming the exclusions a correction removes
  // is omitted when nothing is removed, as here; every other authored line is carried.
  const optional = /\[omit this line when unavailable\]/
  assert.ok(authored('powershell.run').split('\n').some((l) => optional.test(l)), 'the premise: the script carries the optional removal line')
  // The script carries the mode it is CALLED in and no other (invocation.ts
  // scriptForRuns). It used to be carried whole however few modes were offered,
  // so a step that withheld enforcement in the Portal and JSON channels shipped
  // a PowerShell Enforce branch with the policy and its id pre-filled, one
  // word's edit from the mode it did offer.
  const shipped = by.powershell.text
  const declared = SET_RE.exec(shipped)
  assert.equal(declared?.[1], "'Enforce'", `the script still declares modes it is not called in: ${declared?.[1]}`)
  const authoredLines = authored('powershell.run').split('\n').filter((l) => !optional.test(l))
  assert.ok(authoredLines.filter((l) => shipped.includes(l)).length > authoredLines.length / 2, 'the script is not the authored one')
  for (const mode of ['Create', 'CorrectConditions', 'CorrectGrant', 'CorrectSession', 'ReportOnly', 'Verify']) {
    assert.ok(!shipped.includes(`-eq '${mode}'`), `the script still dispatches on ${mode}`)
  }
  assert.doesNotMatch(by.powershell.text, /This change removes|\{\{/)
  assert.ok(
    by.powershell.text.endsWith(`Invoke-IAMAIStep -Mode 'Enforce' -PolicyId '${PILOT_IDS.policy}' -ExcludeGroupIds @('${PILOT_IDS.exclusions}') -AuthenticationStrengthId '${PILOT_IDS.strength}' -LegacyDeviceMfaToggleConfirmedNo -ExternalAuthenticationCompatibilityResolved`),
    by.powershell.text.slice(-300),
  )
  assert.deepEqual(by.json.blocks, ['json.enforce'])
  assert.deepEqual(JSON.parse(by.json.text), { state: 'enabled' })
  assert.deepEqual(by.json.requests, [{ method: 'PATCH', endpoint: `/identity/conditionalAccess/policies/${PILOT_IDS.policy}` }])
  assert.match(by.aiInfo.text, new RegExp(`Policy ID: ${PILOT_IDS.policy}`))
  assert.match(by.aiInfo.text, new RegExp(`Resolved exclusions: ${PILOT_IDS.exclusions}`))
  assert.equal(by.email.text, authored('email.users.pre-enforcement'), 'the Email is not the authored message exactly')
  assert.deepEqual(by.email.communication, { audience: 'affected-users', trigger: 'before-enforcement', purpose: 'pre-change-notice' })
})

// ------------------------------------------------------------ the enforcement gate

test('the checks gate the Enforce action, not the stage; a tenant fact satisfies a check without anybody’s word, and a confirmation holds only while its values hold', () => {
  // the human checks gate the Enforce action, not the stage: no enforcement artifact until they are satisfied
  {
    const held = project('readyToEnforce', {}, pilotRuntime([]))
    assert.deepEqual(held.channels, [])
    assert.deepEqual(held.hold?.pendingPrerequisites, ['legacy-device-mfa-toggle', 'external-auth-methods'])
    // The other states' artifacts are not the enforcement and do not wait on it.
    assert.deepEqual(project('missing', {}, pilotRuntime([])).hold, null)
    assert.deepEqual(project('reportOnly', {}, pilotRuntime([])).hold, null)
    // One unsatisfied check is enough to hold.
    assert.deepEqual(project('readyToEnforce', {}, pilotRuntime(PILOT_PREREQUISITES.filter((id) => id !== 'external-auth-methods'))).hold?.pendingPrerequisites, ['external-auth-methods'])
    // And the switch the script needs is passed only for a satisfied check.
    const readyScript = artifact('readyToEnforce', 'powershell').text
    assert.match(readyScript, /-ExternalAuthenticationCompatibilityResolved$/)
  }
  // a tenant fact satisfies a check without anybody’s word; a confirmation holds only while its values hold
  {
    const bindings = pilotBindings('readyToEnforce', { 'tenant.deviceRegistration.multiFactorAuthConfiguration': 'notRequired' })
    const status = (b = bindings, c: Record<string, { at: string; basis: string }> = {}) => Object.fromEntries(prerequisiteStatus(PKG, 'readyToEnforce', b, c, BASELINE_COMMIT).map((s) => [s.id, s]))
    // The legacy device-registration MFA setting, read as off: satisfied by evidence.
    assert.equal(status()['legacy-device-mfa-toggle'].by, 'evidence')
    assert.equal(status(pilotBindings('readyToEnforce', { 'tenant.deviceRegistration.multiFactorAuthConfiguration': 'required' }))['legacy-device-mfa-toggle'].satisfied, false, 'a setting read as on satisfied the check')
    assert.equal(status(pilotBindings('readyToEnforce'))['legacy-device-mfa-toggle'].satisfied, false, 'a setting the scan did not read satisfied the check')
    // A confirmation, given against these values, counts.
    const prereq = (id: string) => PKG.meta.prerequisites!.find((p) => p.id === id)!
    // A check about the exclusions, as the enrollment-workflow check this package
    // carried until Phase 2e was (owner decision 3: no registration test); test-only here.
    const EXCLUSIONS_CHECK: Prerequisite = { id: 'exclusions-check', class: 'human-validation', requiredBefore: 'readyToEnforce->inPlace', invalidatedBy: ['policy.current.id', 'policy.target.excludeGroups'] }
    const withCheck: CompiledPackage = { ...PKG, meta: { ...PKG.meta, prerequisites: [...PKG.meta.prerequisites!, EXCLUSIONS_CHECK] } }
    const checked = (b = bindings, c: Record<string, { at: string; basis: string }> = {}) => Object.fromEntries(prerequisiteStatus(withCheck, 'readyToEnforce', b, c, BASELINE_COMMIT).map((s) => [s.id, s]))
    const given = { 'exclusions-check': { at: '2026-09-10T00:00:00.000Z', basis: prerequisiteBasis(EXCLUSIONS_CHECK, bindings) }, 'external-auth-methods': { at: '2026-09-10T00:00:00.000Z', basis: prerequisiteBasis(prereq('external-auth-methods'), bindings) } }
    assert.equal(checked(bindings, given)['exclusions-check'].by, 'confirmation')
    assert.equal(status(bindings, given)['external-auth-methods'].confirmedAt, '2026-09-10T00:00:00.000Z')
    // A changed exclusion set is a different thing to have checked…
    const moved = pilotBindings('readyToEnforce', { 'policy.target.excludeGroups': [PILOT_IDS.exclusions, '00000000-0000-4000-8000-00000000e002'] })
    assert.equal(checked(moved, given)['exclusions-check'].satisfied, false, 'a confirmation outlived the exclusions it was given against')
    // …and does not touch the check that is not about exclusions; a recreated policy invalidates both.
    assert.equal(status(moved, given)['external-auth-methods'].satisfied, true)
    const recreated = pilotBindings('readyToEnforce', { 'policy.current.id': '00000000-0000-4000-8000-00000000a002' })
    assert.equal(status(recreated, given)['external-auth-methods'].satisfied, false)
    // The same values in another order are the same values.
    assert.equal(prerequisiteBasis(EXCLUSIONS_CHECK, pilotBindings('readyToEnforce', { 'policy.target.excludeGroups': ['b', 'a'] })), prerequisiteBasis(EXCLUSIONS_CHECK, pilotBindings('readyToEnforce', { 'policy.target.excludeGroups': ['a', 'b'] })))
  }
})

// ------------------------------------------------------------------- Partial

test('Partial selects correction modules from the engine’s changed fields, one API boundary per request, and refuses a field it cannot correct', () => {
  const p = project('partial')
  assert.equal(p.hold, null)
  const by = Object.fromEntries(p.channels.map((c) => [c.channel, c]))
  assert.deepEqual(by.entra.blocks, ['entra.correct.open', 'entra.correct.users.exclusions-canonical', 'entra.correct.grant.authentication-strength', 'entra.correct.save-verify'])
  // Two PATCH bodies to one endpoint are one request with one body.
  assert.deepEqual(by.json.blocks, ['json.correct.conditions', 'json.correct.grant'])
  assert.deepEqual(Object.keys(JSON.parse(by.json.text)).sort(), ['conditions', 'grantControls'])
  assert.deepEqual(by.json.requests, [{ method: 'PATCH', endpoint: `/identity/conditionalAccess/policies/${PILOT_IDS.policy}` }])
  assert.deepEqual(by.powershell.runs, [{ mode: 'Correct', corrections: ['Conditions', 'Grant'] }])
  assert.match(by.powershell.text, /Invoke-IAMAIStep -Mode 'Correct' -Corrections 'Conditions','Grant' -PolicyId/)
  // The selected module ids are what the package's own text names.
  assert.match(by.aiInfo.text, /Differences IAMAI found: users\.exclusions-canonical, grant\.authentication-strength/)
  for (const notDetected of ['entra.correct.users.include-all', 'entra.correct.target.register-or-join-devices', 'entra.correct.conditions.remove-noncanonical', 'entra.correct.lifecycle.report-only']) {
    assert.equal(by.entra.blocks.includes(notDetected), false, `${notDetected} shown for a field the engine did not report`)
  }
  // Two condition fields share the one canonical conditions mutation.
  const shared = project('partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.includeUsers', 'conditions.users.excludeGroups'] })
  assert.deepEqual(shared.channels.find((c) => c.channel === 'json')!.blocks, ['json.correct.conditions'])
  assert.deepEqual(shared.channels.find((c) => c.channel === 'powershell')!.corrections, ['Conditions'])
  // Cycle 3 (C02, RUN-CONTEXT): a live policy being corrected keeps its state. It used to go back
  // to report-only alongside every correction, taking enforcement off to fix a grant; the
  // correction now says what saving does to a policy that is On instead.
  const live = project('partial', { 'policy.current.state': 'enabled', [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] })
  assert.equal(live.channels.find((c) => c.channel === 'entra')!.blocks.includes('entra.correct.lifecycle.report-only'), false)
  assert.match(live.channels.find((c) => c.channel === 'entra')!.text, /If it is On, the changed rule can affect access after you save\./)
  assert.equal('state' in JSON.parse(live.channels.find((c) => c.channel === 'json')!.text), false, 'the correction request writes no state')
  assert.deepEqual(live.channels.find((c) => c.channel === 'powershell')!.corrections, ['Grant'])
  const aloneAlone = project('partial', { 'policy.current.state': 'enabled', [CHANGED_FIELDS_BINDING]: undefined })
  assert.deepEqual(aloneAlone.channels, [], 'returning a policy to report-only was offered as a correction on its own')
  // A field no module covers holds the whole projection: no partial correction.
  const unknown = project('partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups', 'sessionControls.signInFrequency'] })
  assert.deepEqual(unknown.channels, [])
  assert.deepEqual(unknown.hold?.unknownMismatches, ['sessionControls.signInFrequency'])
})

// ---------------------------------------------------------------------- bindings

test('a required binding IAMAI does not hold produces no deployable content, and no unresolved placeholder or authoring marker reaches any projected text', () => {
  // a required binding IAMAI does not hold produces no deployable content
  {
    const noId = project('readyToEnforce', { 'policy.current.id': undefined })
    assert.deepEqual(noId.channels, [])
    assert.deepEqual(noId.hold?.missingBindings, ['policy.current.id'])
    assert.deepEqual(project('missing', { 'policy.target.excludeGroups': [] }).channels, [], 'an empty exclusion set produced a Create')
  }
  // no unresolved placeholder or authoring marker reaches any projected text, and every JSON artifact parses
  {
    for (const state of PACKAGE_STATES) {
      for (const c of project(state).channels) {
        assert.equal(/\{\{|\[omit |\{policy\./.test(c.text), false, `${state}/${c.channel}: a placeholder reached the page`)
        for (const r of c.requests) assert.equal(/\{/.test(r.endpoint), false, `${state}/${c.channel}: an unbound endpoint`)
        if (c.channel === 'json') JSON.parse(c.text)
      }
    }
  }
})

// --------------------------------------------------------------------- readiness

test('Readiness is the package’s rules evaluated deterministically; nothing is Ready from the absence of a problem', () => {
  const tiles = (state: PackageState, over: Record<string, unknown> = {}, runtime = pilotRuntime([])) => Object.fromEntries(packageReadiness(PKG, state, pilotBindings(state, over), runtime)!.tiles.map((t) => [t.id, t]))
  // Exclusions: Ready only from the resolved canonical set, and the runtime's own exclusions tile answers where there is one.
  assert.equal(tiles('readyToEnforce')['readiness.exclusions'].result, 'Ready')
  assert.equal(tiles('readyToEnforce')['readiness.exclusions'].gateKey, 'exclusions')
  assert.equal(tiles('readyToEnforce', { 'policy.target.excludeGroups': undefined })['readiness.exclusions'].result, 'Blocked')
  // The authentication strength: Ready from the strength IAMAI resolved, whichever baseline resolved it, and Blocked without one.
  assert.equal(tiles('missing', {}, { satisfied: new Set(), baselineCommit: BASELINE_COMMIT })['readiness.authentication-strength'].result, 'Ready')
  assert.equal(tiles('missing', { 'authStrength.target.id': undefined })['readiness.authentication-strength'].result, 'Blocked', 'a strength nobody resolved read as Ready')
  // No enrollment-workflow test (owner decision 3, Phase 2e): the package draws no such tile.
  assert.equal(tiles('readyToEnforce')['readiness.enrollment-workflows'], undefined)
  assert.equal(tiles('missing')['readiness.enforcement-settings'].confirm, null, 'a check the current transition does not need asks for confirmation')
  // Enforcement checks: Review required until both are satisfied, then Ready — never a permanent Review required.
  assert.equal(tiles('readyToEnforce')['readiness.enforcement-settings'].result, 'Review required')
  assert.deepEqual(tiles('readyToEnforce')['readiness.enforcement-settings'].confirm, { prerequisites: ['legacy-device-mfa-toggle', 'external-auth-methods'], satisfied: false })
  assert.equal(tiles('readyToEnforce', {}, pilotRuntime(['legacy-device-mfa-toggle', 'external-auth-methods']))['readiness.enforcement-settings'].result, 'Ready')
  // The conclusion is the package's, by state.
  assert.equal(packageReadiness(PKG, 'readyToEnforce', pilotBindings('readyToEnforce'), ALL)!.conclusion, 'Enforce only after external-authentication compatibility is resolved and the legacy device-registration MFA toggle is confirmed No.')
  // And no pilot knowledge is written into the runtime.
  const code = (p: string): string => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const runtime = code('src/content/implementation/project.ts') + code('src/ui/surfaces/stepPackage.ts')
  for (const pilotOnly of ['STATE_SCOPED_RESULT', 'CONCLUSION_FOR', 'SAME_FACT', 'readiness.exclusions', 'readiness.enforcement-settings', 'safeToEnforce', "'policy.current.semanticMismatches'", 'device-registration']) {
    assert.equal(runtime.includes(pilotOnly), false, `the runtime carries pilot knowledge: ${pilotOnly}`)
  }
})

// ------------------------------------------------------ source date and troubleshooting

test('the source date comes from the package’s verified sources, never a clock, and troubleshooting is the package’s, for the state', () => {
  // the source date comes from the package’s verified sources, never a clock
  {
    // mfa-everyone-spec.md §3 B7: three of this package's Learn sources were
    // re-read on 2026-09-20 (policy-all-users-device-registration,
    // concept-conditional-access-cloud-apps, manage-device-identities), so the
    // latest checked date is theirs. The date is still the sources', not a clock:
    // the clone below moves it.
    assert.equal(sourceUpdatedOn(PKG), '2026-09-25')
    const later = structuredClone(PKG)
    later.meta.verifiedSources = [...(later.meta.verifiedSources ?? []), { id: 'x', title: 'x', url: 'https://learn.microsoft.com/x', checkedOn: '2026-10-01', userFacing: true }, { id: 'y', title: 'y', url: 'https://learn.microsoft.com/y', checkedOn: '2027-01-01', userFacing: false }]
    // Every verified source dates the line, user-facing or not (batch A decision 10): the latest checked date wins.
    assert.equal(sourceUpdatedOn(later), '2027-01-01', 'the latest checked source is not the date')
    const W = CONTRACT.implementation
    assert.equal(packageSourceLine(PKG, W), fillText(W.sourceChecked, { date: absoluteDate('2026-09-25T12:00:00Z') }))
  }
  // troubleshooting is the package’s, for the state, and nothing where it authors none
  {
    assert.deepEqual(
      troubleshootingFor(PKG, 'readyToEnforce').map((s) => s.id),
      ['graph-permission-403', 'authentication-strength-cannot-satisfy', 'wcd-bulk-enrollment-mfa', 'legacy-device-mfa-toggle-conflict'],
    )
    assert.deepEqual(troubleshootingFor(PKG, 'blocked'), [])
    for (const s of troubleshootingFor(PKG, 'inPlace')) for (const src of s.sources) assert.equal(src.userFacing, true, `${s.id}: a research-only source is shown`)
  }
})

// --------------------------------------------------------------- runtime adapter

function stepAndContext(name: 'small' | 'demo', shape: (f: ReturnType<typeof fixture>) => ReturnType<typeof fixture> = (f) => f): { step: Step; ctx: StepVarContext } {
  const f = shape(structuredClone(fixture(name)))
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === PILOT_STEP_ID)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
  return { step, ctx }
}

test('a real fixture step reaches all five channels through the runtime adapter once its checks are confirmed; where Foundation A withholds the operation, Exclusions is not Ready', () => {
  // a real fixture step at Ready to enforce reaches all five channels through the runtime adapter, once its checks are confirmed
  {
    const { step: base, ctx } = stepAndContext('small')
    const step = pilotStepAt(base, 'readyToEnforce')
    const c = stepContract(step, ctx)
    assert.equal(c.state.lifecycle, 'ready-to-enforce')
    assert.equal(c.implementation.offered, true)
    assert.equal(packageStateOf(step, c, ctx.snapshot), 'readyToEnforce')
    const bindings = packageBindings(step, ctx, c)
    assert.equal(bindings['policy.current.id'], PILOT_IDS.policy)
    assert.ok(Array.isArray(bindings['policy.target.excludeGroups']) && (bindings['policy.target.excludeGroups'] as string[]).length > 0)
    assert.equal(bindings['policy.current.semanticMismatches'], undefined, 'a semantic-mismatch list was invented')
    assert.equal(bindings[CHANGED_FIELDS_BINDING], undefined, 'an enforcement was read as a correction')
    // The fixture tenant's device-registration setting is read, and satisfies its check.
    assert.equal(bindings['tenant.deviceRegistration.multiFactorAuthConfiguration'], 'notRequired')
    const unconfirmed = packageRuntime(PKG, 'readyToEnforce', bindings, {}, PILOT_PIN)
    assert.deepEqual(projectImplementation(PKG, 'readyToEnforce', bindings, unconfirmed.runtime).hold?.pendingPrerequisites, ['external-auth-methods'])
    const at = '2026-09-10T00:00:00.000Z'
    const basis = (id: string) => prerequisiteBasis(PKG.meta.prerequisites!.find((p) => p.id === id)!, bindings)
    const confirmed = packageRuntime(PKG, 'readyToEnforce', bindings, { 'external-auth-methods': { at, basis: basis('external-auth-methods') } }, PILOT_PIN)
    const p = projectImplementation(PKG, 'readyToEnforce', bindings, confirmed.runtime)
    assert.equal(p.hold, null)
    assert.deepEqual(p.channels.map((x) => x.channel), ['entra', 'powershell', 'json', 'aiInfo', 'email'])
    const merged = mergeReadiness(readinessOf(step, c), packageReadiness(PKG, 'readyToEnforce', bindings, confirmed.runtime))
    // Every package gate is a tile (A1 §16.1): unresolved ones among the tiles, satisfied ones among the evidence, none dropped to fit.
    const runtimeKeys = new Set([...readinessOf(step, c).tiles, ...readinessOf(step, c).satisfied].map((t) => t.key))
    const mergedKeys = new Set([...merged.tiles, ...merged.satisfied].map((t) => t.key))
    for (const t of packageReadiness(PKG, 'readyToEnforce', bindings, confirmed.runtime)!.tiles) assert.ok(mergedKeys.has(t.id) || (t.gateKey !== null && runtimeKeys.has(t.gateKey)), `${t.id} was dropped to fit`)
    const missing = pilotStepAt(base, 'missing')
    assert.equal(packageStateOf(missing, stepContract(missing, ctx), ctx.snapshot), 'missing')
  }
  // where Foundation A withholds the operation, the target is unresolved and Exclusions is not Ready
  {
    // With no exclusions group chosen, Foundation A has nothing to exclude and
    // withholds the operation (the demo's unmapped group did this until Phase 2a).
    const { step, ctx } = stepAndContext('demo', (f) => {
      f.mapping.records = Object.fromEntries(Object.entries(f.mapping.records ?? {}).filter(([k]) => k !== EXCLUSIONS_RECORD_KEY))
      return f
    })
    const c = stepContract(step, ctx)
    const bindings = packageBindings(step, ctx, c)
    assert.equal(bindings['policy.target.excludeGroups'], undefined)
    const state = packageStateOf(step, c, ctx.snapshot)!
    const tile = packageReadiness(PKG, state, bindings, ALL)!.tiles.find((t) => t.id === 'readiness.exclusions')!
    assert.equal(tile.result, 'Blocked')
  }
})
