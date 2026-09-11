// The implementation-content pilot: s-goal-device-registration-mfa, end to end,
// against the runtime contract (README.md).
//
// Package ingestion (protocol.ts), state projection, Partial composition from the
// engine's semantic facts, the enforcement gate and owner confirmations,
// bindings, readiness, troubleshooting and the source date (project.ts), the
// runtime adapter that hands IAMAI's state to the package (stepPackage.ts), and
// the viewer that draws it (ContentStep.tsx). The fixture supplies state, bindings
// and confirmations; every word of content is read from the package itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANGED_FIELDS_BINDING, PackageError, compilePackage, parseBlocks, validatePackage } from './protocol.ts'
import type { CompiledPackage } from './protocol.ts'
import { OUTPUT_ORDER, PACKAGE_STATES, packageReadiness, prerequisiteBasis, prerequisiteStatus, projectImplementation, sourceUpdatedOn, troubleshootingFor } from './project.ts'
import type { PackageState } from './project.ts'
import registry from './registry.generated.json' with { type: 'json' }
import { PILOT_IDS, PILOT_PIN, PILOT_PREREQUISITES, PILOT_STEP_ID, pilotBindings, pilotRuntime, pilotStepAt } from '../../testing/pilotFixture.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { CONTRACT, readinessOf, stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { BASELINE_COMMIT, REGISTERED_PACKAGE_STEP_IDS, implementationPackageFor, mergeReadiness, packageBindings, packageRuntime, packageSourceLine, packageStateOf } from '../../ui/surfaces/stepPackage.ts'
import { fillText } from '../render.ts'
import { absoluteDate } from '../../copy/dates.ts'

const DIR = `docs/implementation-content/${PILOT_STEP_ID}`
const read = (p: string): string => readFileSync(p, 'utf8')
const PKG: CompiledPackage = compilePackage(read(`${DIR}/META.json`), read(`${DIR}/CONTENT.md`))
const ALL = pilotRuntime()
const project = (state: PackageState, over: Record<string, unknown> = {}, runtime = ALL) => projectImplementation(PKG, state, pilotBindings(state, over), runtime)
const channelsOf = (state: PackageState, over: Record<string, unknown> = {}): string[] => project(state, over).channels.map((c) => c.channel)
const artifact = (state: PackageState, channel: string, over: Record<string, unknown> = {}) => project(state, over).channels.find((c) => c.channel === channel)!
const authored = (id: string): string => PKG.blocks[id].text.replace(/\s+$/, '')

// ------------------------------------------------------------ package ingestion

test('the pilot package compiles under the strict contract: every projected block, invocation, condition and model is sound', () => {
  assert.equal(PKG.meta.stepId, PILOT_STEP_ID)
  assert.deepEqual(validatePackage(PKG), [])
  assert.equal(Object.keys(PKG.blocks).length, 24)
  assert.deepEqual(Object.keys(PKG.meta.projection).sort(), [...PACKAGE_STATES].sort())
})

test('the registry holds the pilot exactly as compiled, authored against the baseline pin the build carries', () => {
  const packages = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
  assert.deepEqual(packages[PILOT_STEP_ID], JSON.parse(JSON.stringify(PKG)), 'registry.generated.json drifted from its sources: run scripts/compile-implementation-content.mjs --registry')
  assert.ok(REGISTERED_PACKAGE_STEP_IDS.includes(PILOT_STEP_ID))
  // Re-authored against the build's pin on 2026-09-11 (it named 8461e0f2 before).
  assert.equal(BASELINE_COMMIT, JSON.parse(read('baselines/jhope188-conditionalaccesspolicies.pinned.json')).commit)
  assert.equal(PILOT_PIN, BASELINE_COMMIT)
  assert.equal(implementationPackageFor({ id: PILOT_STEP_ID, goalId: 'device-registration-mfa' }), packages[PILOT_STEP_ID])
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
  assert.ok(by.powershell.text.includes(authored('powershell.run')), 'the authored script is not carried whole')
  assert.ok(
    by.powershell.text.endsWith(`Invoke-IAMAIStep -Mode 'Enforce' -PolicyId '${PILOT_IDS.policy}' -ExcludeGroupIds @('${PILOT_IDS.exclusions}') -AuthenticationStrengthId '${PILOT_IDS.strength}' -LegacyDeviceMfaToggleConfirmedNo -EnrollmentWorkflowsValidated -ExternalAuthenticationCompatibilityResolved`),
    by.powershell.text.slice(-300),
  )
  assert.deepEqual(by.json.blocks, ['json.enforce'])
  assert.deepEqual(JSON.parse(by.json.text), { state: 'enabled' })
  assert.deepEqual(by.json.requests, [{ method: 'PATCH', endpoint: `/identity/conditionalAccess/policies/${PILOT_IDS.policy}` }])
  assert.match(by.aiInfo.text, new RegExp(`Policy ID: ${PILOT_IDS.policy}`))
  assert.match(by.aiInfo.text, new RegExp(`Canonical exclusions: ${PILOT_IDS.exclusions}`))
  assert.equal(by.email.text, authored('email.users.pre-enforcement'), 'the Email is not the authored message exactly')
  assert.deepEqual(by.email.communication, { audience: 'affected-users', trigger: 'before-enforcement', purpose: 'pre-change-notice' })
})

test('Email appears only where META.json projects it', () => {
  for (const state of PACKAGE_STATES) {
    const email = project(state).channels.find((c) => c.channel === 'email')
    assert.equal(email !== undefined, state === 'readyToEnforce', `${state}: Email presence`)
  }
})

// ------------------------------------------------------------ the enforcement gate

test('the human checks gate the Enforce action, not the stage: no enforcement artifact until they are satisfied', () => {
  const held = project('readyToEnforce', {}, pilotRuntime([]))
  assert.deepEqual(held.channels, [])
  assert.deepEqual(held.hold?.pendingPrerequisites, ['legacy-device-mfa-toggle', 'enrollment-workflows', 'external-auth-methods'])
  // The other states' artifacts are not the enforcement and do not wait on it.
  assert.deepEqual(project('missing', {}, pilotRuntime([])).hold, null)
  assert.deepEqual(project('reportOnly', {}, pilotRuntime([])).hold, null)
  // One unsatisfied check is enough to hold.
  assert.deepEqual(project('readyToEnforce', {}, pilotRuntime(PILOT_PREREQUISITES.filter((id) => id !== 'external-auth-methods'))).hold?.pendingPrerequisites, ['external-auth-methods'])
  // And the switch the script needs is passed only for a satisfied check.
  const readyScript = artifact('readyToEnforce', 'powershell').text
  assert.match(readyScript, /-ExternalAuthenticationCompatibilityResolved$/)
})

test('a tenant fact satisfies a check without anybody’s word; a confirmation holds only while its values hold', () => {
  const bindings = pilotBindings('readyToEnforce', { 'tenant.deviceRegistration.multiFactorAuthConfiguration': 'notRequired' })
  const status = (b = bindings, c: Record<string, { at: string; basis: string }> = {}) => Object.fromEntries(prerequisiteStatus(PKG, 'readyToEnforce', b, c, BASELINE_COMMIT).map((s) => [s.id, s]))
  // The legacy device-registration MFA setting, read as off: satisfied by evidence.
  assert.equal(status()['legacy-device-mfa-toggle'].by, 'evidence')
  assert.equal(status(pilotBindings('readyToEnforce', { 'tenant.deviceRegistration.multiFactorAuthConfiguration': 'required' }))['legacy-device-mfa-toggle'].satisfied, false, 'a setting read as on satisfied the check')
  assert.equal(status(pilotBindings('readyToEnforce'))['legacy-device-mfa-toggle'].satisfied, false, 'a setting the scan did not read satisfied the check')
  // A confirmation, given against these values, counts.
  const prereq = (id: string) => PKG.meta.prerequisites!.find((p) => p.id === id)!
  const given = { 'enrollment-workflows': { at: '2026-09-10T00:00:00.000Z', basis: prerequisiteBasis(prereq('enrollment-workflows'), bindings) }, 'external-auth-methods': { at: '2026-09-10T00:00:00.000Z', basis: prerequisiteBasis(prereq('external-auth-methods'), bindings) } }
  assert.equal(status(bindings, given)['enrollment-workflows'].by, 'confirmation')
  assert.equal(status(bindings, given)['external-auth-methods'].confirmedAt, '2026-09-10T00:00:00.000Z')
  // A changed exclusion set is a different thing to have validated workflows for…
  const moved = pilotBindings('readyToEnforce', { 'policy.target.excludeGroups': [PILOT_IDS.exclusions, '00000000-0000-4000-8000-00000000e002'] })
  assert.equal(status(moved, given)['enrollment-workflows'].satisfied, false, 'a confirmation outlived the exclusions it was given against')
  // …and does not touch the check that is not about exclusions; a recreated policy invalidates both.
  assert.equal(status(moved, given)['external-auth-methods'].satisfied, true)
  const recreated = pilotBindings('readyToEnforce', { 'policy.current.id': '00000000-0000-4000-8000-00000000a002' })
  assert.equal(status(recreated, given)['external-auth-methods'].satisfied, false)
  // The same values in another order are the same values.
  assert.equal(prerequisiteBasis(prereq('enrollment-workflows'), pilotBindings('readyToEnforce', { 'policy.target.excludeGroups': ['b', 'a'] })), prerequisiteBasis(prereq('enrollment-workflows'), pilotBindings('readyToEnforce', { 'policy.target.excludeGroups': ['a', 'b'] })))
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
  assert.match(by.aiInfo.text, /IAMAI mismatches: users\.exclusions-canonical, grant\.authentication-strength/)
  for (const notDetected of ['entra.correct.users.include-all', 'entra.correct.target.register-or-join-devices', 'entra.correct.conditions.remove-noncanonical', 'entra.correct.lifecycle.report-only']) {
    assert.equal(by.entra.blocks.includes(notDetected), false, `${notDetected} shown for a field the engine did not report`)
  }
  // Two condition fields share the one canonical conditions mutation.
  const shared = project('partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.includeUsers', 'conditions.users.excludeGroups'] })
  assert.deepEqual(shared.channels.find((c) => c.channel === 'json')!.blocks, ['json.correct.conditions'])
  assert.deepEqual(shared.channels.find((c) => c.channel === 'powershell')!.corrections, ['Conditions'])
  // A live policy being corrected goes back to report-only alongside the correction, never on its own.
  const live = project('partial', { 'policy.current.state': 'enabled', [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] })
  assert.ok(live.channels.find((c) => c.channel === 'entra')!.blocks.includes('entra.correct.lifecycle.report-only'))
  assert.deepEqual(JSON.parse(live.channels.find((c) => c.channel === 'json')!.text).state, 'enabledForReportingButNotEnforced')
  assert.deepEqual(live.channels.find((c) => c.channel === 'powershell')!.corrections, ['Grant', 'ReportOnly'])
  const aloneAlone = project('partial', { 'policy.current.state': 'enabled', [CHANGED_FIELDS_BINDING]: undefined })
  assert.deepEqual(aloneAlone.channels, [], 'returning a policy to report-only was offered as a correction on its own')
  // A field no module covers holds the whole projection: no partial correction.
  const unknown = project('partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups', 'sessionControls.signInFrequency'] })
  assert.deepEqual(unknown.channels, [])
  assert.deepEqual(unknown.hold?.unknownMismatches, ['sessionControls.signInFrequency'])
  // Nothing here reads a title, a heading or a reason sentence to decide.
  const code = read('src/content/implementation/project.ts')
  for (const heuristic of ['displayName', 'title.', 'appliesWhen']) assert.equal(new RegExp(`\\b${heuristic.replace('.', '\\.')}`).test(code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), false, `project.ts decides on ${heuristic}`)
})

// ---------------------------------------------------------------------- bindings

test('a required binding IAMAI does not hold produces no deployable content', () => {
  const noId = project('readyToEnforce', { 'policy.current.id': undefined })
  assert.deepEqual(noId.channels, [])
  assert.deepEqual(noId.hold?.missingBindings, ['policy.current.id'])
  assert.deepEqual(project('missing', { 'policy.target.excludeGroups': [] }).channels, [], 'an empty exclusion set produced a Create')
})

test('an optional binding IAMAI does not hold disappears with its line', () => {
  const observe = artifact('reportOnly', 'aiInfo').text
  assert.equal(/device-registration evidence|Enrollment-workflow evidence|Current blockers/.test(observe), false, 'an unavailable optional line survived')
  assert.match(artifact('missing', 'aiInfo').text, /^- Tenant: Contoso \(sample\)$/m)
  assert.equal(/Tenant:/.test(artifact('missing', 'aiInfo', { 'tenant.displayName': undefined }).text), false)
})

test('no unresolved placeholder or authoring marker reaches any projected text, and every JSON artifact parses', () => {
  for (const state of PACKAGE_STATES) {
    for (const c of project(state).channels) {
      assert.equal(/\{\{|\[omit |\{policy\./.test(c.text), false, `${state}/${c.channel}: a placeholder reached the page`)
      for (const r of c.requests) assert.equal(/\{/.test(r.endpoint), false, `${state}/${c.channel}: an unbound endpoint`)
      if (c.channel === 'json') JSON.parse(c.text)
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
  // Enrollment workflows: Unknown with no evidence, a confirmation the enforcement waits on, Ready once confirmed.
  const unconfirmed = tiles('readyToEnforce')['readiness.enrollment-workflows']
  assert.equal(unconfirmed.result, 'Unknown')
  assert.deepEqual(unconfirmed.confirm, { prerequisites: ['enrollment-workflows'], satisfied: false })
  assert.equal(tiles('readyToEnforce', {}, pilotRuntime(['enrollment-workflows']))['readiness.enrollment-workflows'].result, 'Ready')
  assert.equal(tiles('missing')['readiness.enrollment-workflows'].confirm, null, 'a check the current transition does not need asks for confirmation')
  // Enforcement checks: Review required until both are satisfied, then Ready — never a permanent Review required.
  assert.equal(tiles('readyToEnforce')['readiness.enforcement-settings'].result, 'Review required')
  assert.deepEqual(tiles('readyToEnforce')['readiness.enforcement-settings'].confirm, { prerequisites: ['legacy-device-mfa-toggle', 'external-auth-methods'], satisfied: false })
  assert.equal(tiles('readyToEnforce', {}, pilotRuntime(['legacy-device-mfa-toggle', 'external-auth-methods']))['readiness.enforcement-settings'].result, 'Ready')
  // The conclusion is the package's, by state.
  assert.equal(packageReadiness(PKG, 'readyToEnforce', pilotBindings('readyToEnforce'), ALL)!.conclusion, 'Enforce only after enrollment workflows pass, external-authentication compatibility is resolved, and the legacy device-registration MFA toggle is confirmed No.')
  // And no pilot knowledge is written into the runtime.
  const code = (p: string): string => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const runtime = code('src/content/implementation/project.ts') + code('src/ui/surfaces/stepPackage.ts')
  for (const pilotOnly of ['STATE_SCOPED_RESULT', 'CONCLUSION_FOR', 'SAME_FACT', 'readiness.exclusions', 'readiness.enforcement-settings', 'safeToEnforce', "'policy.current.semanticMismatches'", 'device-registration']) {
    assert.equal(runtime.includes(pilotOnly), false, `the runtime carries pilot knowledge: ${pilotOnly}`)
  }
})

// ------------------------------------------------------------------- source date

test('the source date comes from the package’s verified sources, never a clock', () => {
  assert.equal(sourceUpdatedOn(PKG), '2026-09-10')
  const later = structuredClone(PKG)
  later.meta.verifiedSources = [...(later.meta.verifiedSources ?? []), { id: 'x', title: 'x', url: 'https://learn.microsoft.com/x', checkedOn: '2026-10-01', userFacing: true }, { id: 'y', title: 'y', url: 'https://learn.microsoft.com/y', checkedOn: '2027-01-01', userFacing: false }]
  assert.equal(sourceUpdatedOn(later), '2026-10-01', 'the latest user-facing source is not the date, or a research-only source moved it')
  const code = read('src/content/implementation/project.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const clock of ['Date.now', 'new Date(', 'performance.now', 'mtime', 'import.meta.env']) assert.equal(code.includes(clock), false, `project.ts reads ${clock}`)
  const W = CONTRACT.implementation
  assert.equal(packageSourceLine(PKG, W), `${fillText(W.sourceUpdated, { date: absoluteDate('2026-09-10T12:00:00Z') })} · ${fillText(W.sourcePins, { authored: BASELINE_COMMIT.slice(0, 8), pinned: BASELINE_COMMIT.slice(0, 8) })}`)
  assert.match(read('src/ui/surfaces/ContentStep.tsx'), /const sourceLine = pkg \? packageSourceLine\(pkg, W, baselineCommit\) : null/)
})

// --------------------------------------------------------------- troubleshooting

test('troubleshooting is the package’s, for the state, and nothing where it authors none', () => {
  assert.deepEqual(
    troubleshootingFor(PKG, 'readyToEnforce').map((s) => s.id),
    ['graph-permission-403', 'authentication-strength-cannot-satisfy', 'wcd-bulk-enrollment-mfa', 'legacy-device-mfa-toggle-conflict'],
  )
  assert.deepEqual(troubleshootingFor(PKG, 'blocked'), [])
  for (const s of troubleshootingFor(PKG, 'inPlace')) for (const src of s.sources) assert.equal(src.userFacing, true, `${s.id}: a research-only source is shown`)
})

// --------------------------------------------------------------- runtime adapter

function stepAndContext(name: 'small' | 'demo'): { step: Step; ctx: StepVarContext } {
  const f = fixture(name)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === PILOT_STEP_ID)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
  return { step, ctx }
}

test('runtime truth decides the package state: a blocked fixture step implements nothing', () => {
  const { step, ctx } = stepAndContext('small')
  const c = stepContract(step, ctx)
  const state = packageStateOf(step, c, ctx.snapshot)
  assert.ok(state === 'blocked' || state === 'missing', `unexpected ${state}`)
  if (state === 'blocked') assert.deepEqual(projectImplementation(PKG, 'blocked', packageBindings(step, ctx, c), ALL).channels, [])
})

test('a real fixture step at Ready to enforce reaches all five channels through the runtime adapter, once its checks are confirmed', () => {
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
  assert.deepEqual(projectImplementation(PKG, 'readyToEnforce', bindings, unconfirmed.runtime).hold?.pendingPrerequisites, ['enrollment-workflows', 'external-auth-methods'])
  const at = '2026-09-10T00:00:00.000Z'
  const basis = (id: string) => prerequisiteBasis(PKG.meta.prerequisites!.find((p) => p.id === id)!, bindings)
  const confirmed = packageRuntime(PKG, 'readyToEnforce', bindings, { 'enrollment-workflows': { at, basis: basis('enrollment-workflows') }, 'external-auth-methods': { at, basis: basis('external-auth-methods') } }, PILOT_PIN)
  const p = projectImplementation(PKG, 'readyToEnforce', bindings, confirmed.runtime)
  assert.equal(p.hold, null)
  assert.deepEqual(p.channels.map((x) => x.channel), ['entra', 'powershell', 'json', 'aiInfo', 'email'])
  const merged = mergeReadiness(readinessOf(step, c), packageReadiness(PKG, 'readyToEnforce', bindings, confirmed.runtime))
  assert.ok(merged.tiles.length <= 3)
  const missing = pilotStepAt(base, 'missing')
  assert.equal(packageStateOf(missing, stepContract(missing, ctx), ctx.snapshot), 'missing')
})

test('where Foundation A withholds the operation, the target is unresolved and Exclusions is not Ready', () => {
  const { step, ctx } = stepAndContext('demo')
  const c = stepContract(step, ctx)
  const bindings = packageBindings(step, ctx, c)
  assert.equal(bindings['policy.target.excludeGroups'], undefined)
  const state = packageStateOf(step, c, ctx.snapshot)!
  const tile = packageReadiness(PKG, state, bindings, ALL)!.tiles.find((t) => t.id === 'readiness.exclusions')!
  assert.equal(tile.result, 'Blocked')
})

// ------------------------------------------------------------------------ viewer

test('the viewer draws every package channel through the one Implementation region, safely', () => {
  const step = read('src/ui/surfaces/ContentStep.tsx')
  const ids = [...(step.match(/const CHANNEL_TABS: TabItem\[\] = \[[\s\S]*?\]/)?.[0] ?? '').matchAll(/id: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ids, ['portal', 'ps', 'json', 'ai', 'email'], 'Email is not the fifth member of the one selector')
  assert.match(step, /const PACKAGE_CHANNEL: Record<OutputChannel, Channel> = \{ entra: 'portal', powershell: 'ps', json: 'json', aiInfo: 'ai', email: 'email' \}/)
  assert.equal(step.split('<Implementation\n').length - 1, 1)
  // The region says who drew it, so a check of the translator's portal lines reads only the steps the translator drew.
  assert.match(step, /<section className="step-section implementation-section" data-implementation=\{drawnBy\} data-preview=\{preview \? 'true' : undefined\}>/)
  assert.match(step, /drawnBy=\{packaged \? 'package' : 'translator'\}/)
  assert.match(step, /onClick=\{\(\) => copy\('implementation', active\?\.text\(\) \?\? ''\)\}/)
  assert.match(step, /<Implementation[\s\S]*?copy=\{copyArtifact\}/)
  assert.equal(step.split("{tab === 'ai' && (").length - 1, 2)
  assert.match(step, /const artifacts: Artifact\[\] = packaged\n\s*\? \(\(preview \?\? projection\)\?\.channels \?\? \[\]\)\.map\(packageArtifact\)/)
  // The projection, the readiness and the troubleshooting never throw through the step.
  for (const safe of ['projectSafely(', 'readinessSafely(', 'troubleshootingSafely(']) assert.ok(step.includes(safe), `ContentStep calls the package without ${safe}`)
  for (const unsafe of ['projectImplementation(', 'packageReadiness(', 'troubleshootingFor(']) assert.equal(step.includes(unsafe), false, `ContentStep calls ${unsafe} directly`)
  // A confirmation is the tile's, in the approved dialog grammar.
  assert.match(step, /dialog === 'confirm'/)
})
