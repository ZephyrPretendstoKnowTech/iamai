// The implementation-content pilot: s-goal-device-registration-mfa, end to end.
//
// Package ingestion (protocol.ts), state projection, Partial composition,
// bindings, Readiness, troubleshooting and the source date (project.ts), the
// runtime adapter that hands IAMAI's state to the package (stepPackage.ts), and
// the viewer that draws it (ContentStep.tsx). The fixture supplies state and
// bindings; every word of content is read from the package itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PackageError, compilePackage, parseBlocks, validatePackage } from './protocol.ts'
import type { CompiledPackage } from './protocol.ts'
import { OUTPUT_ORDER, PACKAGE_STATES, packageReadiness, projectImplementation, sourceUpdatedOn, troubleshootingFor } from './project.ts'
import type { PackageState } from './project.ts'
import registry from './registry.generated.json' with { type: 'json' }
import { PILOT_IDS, PILOT_STEP_ID, pilotBindings, pilotStepAt } from '../../testing/pilotFixture.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { readinessOf, stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { ACTIVE_PACKAGE_STEP_IDS, implementationPackageFor, mergeReadiness, packageBindings, packageStateOf } from '../../ui/surfaces/stepPackage.ts'

const DIR = `docs/implementation-content/${PILOT_STEP_ID}`
const read = (p: string): string => readFileSync(p, 'utf8')
const source = (): CompiledPackage => compilePackage(read(`${DIR}/META.json`), read(`${DIR}/CONTENT.md`))
const PKG = source()
const channelsOf = (state: PackageState, over: Record<string, unknown> = {}): string[] => projectImplementation(PKG, state, pilotBindings(state, over)).channels.map((c) => c.channel)
const artifact = (state: PackageState, channel: string) => projectImplementation(PKG, state, pilotBindings(state)).channels.find((c) => c.channel === channel)!
const bound = (id: string): string => PKG.blocks[id].text.replace(/\s+$/, '')

// ------------------------------------------------------------ package ingestion

test('the pilot package compiles: META.json parses and every projected block exists', () => {
  assert.equal(PKG.meta.stepId, PILOT_STEP_ID)
  assert.deepEqual(validatePackage(PKG), [])
  assert.equal(Object.keys(PKG.blocks).length, 24)
  // Every state the package names is one the projection knows, and no other.
  assert.deepEqual(Object.keys(PKG.meta.projection).sort(), [...PACKAGE_STATES].sort())
})

test('the generated registry is the compiled pilot, and the pilot is the only active package', () => {
  const packages = (registry as unknown as { packages: Record<string, unknown> }).packages
  assert.deepEqual(Object.keys(packages), [PILOT_STEP_ID], 'another implementation-content package became active')
  assert.deepEqual(packages[PILOT_STEP_ID], JSON.parse(JSON.stringify(PKG)), 'registry.generated.json drifted from its sources: run scripts/compile-implementation-content.mjs --registry')
  assert.deepEqual([...ACTIVE_PACKAGE_STEP_IDS], [PILOT_STEP_ID])
  assert.equal(implementationPackageFor('s-goal-block-legacy-auth'), null, 'a step without an active package gained one')
})

test('a duplicate, nested, unterminated or unknown block fails, and so does an unsupported channel', () => {
  const block = (id: string, channel = 'entra', states = ['missing']) => `@@IAMAI-BEGIN ${JSON.stringify({ id, channel, states, format: 'markdown' })}\nText.\n@@IAMAI-END\n`
  assert.throws(() => parseBlocks(block('entra.create') + block('entra.create')), PackageError)
  assert.throws(() => parseBlocks(`@@IAMAI-BEGIN {"id":"a","channel":"entra"}\n@@IAMAI-BEGIN {"id":"b","channel":"entra"}\n@@IAMAI-END\n@@IAMAI-END\n`), PackageError)
  assert.throws(() => parseBlocks(`@@IAMAI-BEGIN {"id":"a","channel":"entra"}\nText.\n`), PackageError)
  assert.throws(() => parseBlocks(`@@IAMAI-BEGIN {not json}\n@@IAMAI-END\n`), PackageError)
  // META.json names a block CONTENT.md does not have.
  const meta = JSON.parse(read(`${DIR}/META.json`)) as { projection: { missing: { entra: string[] } } }
  meta.projection.missing.entra = ['entra.nope']
  assert.throws(() => compilePackage(JSON.stringify(meta), read(`${DIR}/CONTENT.md`)), /missing block entra\.nope/)
  // A block in a channel the viewer does not have.
  const odd = validatePackage({ meta: { stepId: 'x', projection: {} }, blocks: parseBlocks(block('fax.send', 'fax')) })
  assert.ok(odd.some((e) => /unsupported channel fax/.test(e)), odd.join('\n'))
  // A projection that names a channel the viewer does not have.
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
  // The viewer order is the approved selector with Email appended.
  assert.deepEqual([...OUTPUT_ORDER], ['entra', 'powershell', 'json', 'aiInfo', 'email'])
})

test('Ready to enforce projects all five channels, each from its enforce block', () => {
  const p = projectImplementation(PKG, 'readyToEnforce', pilotBindings('readyToEnforce'))
  assert.equal(p.hold, null)
  const by = Object.fromEntries(p.channels.map((c) => [c.channel, c]))
  assert.deepEqual(by.entra.blocks, ['entra.enforce'])
  assert.equal(by.entra.text, bound('entra.enforce'))
  assert.deepEqual(by.powershell.blocks, ['powershell.run'])
  assert.equal(by.powershell.mode, 'Enforce')
  assert.equal(by.powershell.text, bound('powershell.run'))
  assert.deepEqual(by.json.blocks, ['json.enforce'])
  assert.deepEqual(JSON.parse(by.json.text), { state: 'enabled' })
  assert.deepEqual(by.json.requests, [{ method: 'PATCH', endpoint: `/identity/conditionalAccess/policies/${PILOT_IDS.policy}` }])
  assert.deepEqual(by.aiInfo.blocks, ['ai.enforce'])
  assert.match(by.aiInfo.text, new RegExp(`Policy ID: ${PILOT_IDS.policy}`))
  assert.match(by.aiInfo.text, new RegExp(`Canonical exclusions: ${PILOT_IDS.exclusions}`))
  assert.deepEqual(by.email.blocks, ['email.users.pre-enforcement'])
  assert.equal(by.email.text, bound('email.users.pre-enforcement'), 'the Email is not the authored message exactly')
})

test('Email appears only where META.json projects it, with its audience and trigger', () => {
  for (const state of PACKAGE_STATES) {
    const email = projectImplementation(PKG, state, pilotBindings(state)).channels.find((c) => c.channel === 'email')
    assert.equal(email !== undefined, state === 'readyToEnforce', `${state}: Email presence`)
  }
  assert.deepEqual(artifact('readyToEnforce', 'email').communication, { audience: 'affected-users', trigger: 'before-enforcement', purpose: 'pre-change-notice' })
})

test('Partial composes only the detected mismatches, shares one API boundary and refuses an unknown one', () => {
  const p = projectImplementation(PKG, 'partial', pilotBindings('partial'))
  const by = Object.fromEntries(p.channels.map((c) => [c.channel, c]))
  assert.deepEqual(by.entra.blocks, ['entra.correct.open', 'entra.correct.users.exclusions-canonical', 'entra.correct.grant.authentication-strength', 'entra.correct.save-verify'])
  assert.deepEqual(by.json.blocks, ['json.correct.conditions', 'json.correct.grant'])
  assert.equal(by.powershell.mode, 'Correct')
  assert.deepEqual(by.powershell.corrections, ['Conditions', 'Grant'])
  for (const notDetected of ['entra.correct.users.include-all', 'entra.correct.target.register-or-join-devices', 'entra.correct.conditions.remove-noncanonical', 'entra.correct.lifecycle.report-only']) {
    assert.equal(by.entra.blocks.includes(notDetected), false, `${notDetected} shown for a mismatch IAMAI did not report`)
  }
  // Two condition mismatches share the one canonical conditions mutation.
  const shared = projectImplementation(PKG, 'partial', pilotBindings('partial', { 'policy.current.semanticMismatches': ['users.include-all', 'users.exclusions-canonical'] }))
  const sj = shared.channels.find((c) => c.channel === 'json')!
  assert.deepEqual(sj.blocks, ['json.correct.conditions'])
  assert.deepEqual(shared.channels.find((c) => c.channel === 'powershell')!.corrections, ['Conditions'])
  // A mismatch the package has no module for produces nothing.
  const unknown = projectImplementation(PKG, 'partial', pilotBindings('partial', { 'policy.current.semanticMismatches': ['users.include-all', 'grant.made-up'] }))
  assert.deepEqual(unknown.channels, [])
  assert.deepEqual(unknown.hold?.unknownMismatches, ['grant.made-up'])
})

// ---------------------------------------------------------------------- bindings

test('a required binding IAMAI does not hold produces no deployable content', () => {
  const noId = projectImplementation(PKG, 'readyToEnforce', pilotBindings('readyToEnforce', { 'policy.current.id': undefined }))
  assert.deepEqual(noId.channels, [])
  assert.deepEqual(noId.hold?.missingBindings, ['policy.current.id'])
  const noExclusions = projectImplementation(PKG, 'missing', pilotBindings('missing', { 'policy.target.excludeGroups': [] }))
  assert.deepEqual(noExclusions.channels, [], 'an empty exclusion set produced a Create')
  const noMismatches = projectImplementation(PKG, 'partial', pilotBindings('partial', { 'policy.current.semanticMismatches': undefined }))
  assert.deepEqual(noMismatches.channels, [], 'Partial composed without IAMAI mismatches')
})

test('an optional binding IAMAI does not hold disappears with its line', () => {
  const observe = artifact('reportOnly', 'aiInfo').text
  assert.equal(/device-registration evidence|Enrollment-workflow evidence|Current blockers/.test(observe), false, 'an unavailable optional line survived')
  const withTenant = artifact('missing', 'aiInfo').text
  assert.match(withTenant, /^- Tenant: Contoso \(sample\)$/m)
  const withoutTenant = projectImplementation(PKG, 'missing', pilotBindings('missing', { 'tenant.displayName': undefined })).channels.find((c) => c.channel === 'aiInfo')!.text
  assert.equal(/Tenant:/.test(withoutTenant), false)
})

test('no unresolved placeholder or authoring marker reaches any projected text', () => {
  for (const state of PACKAGE_STATES) {
    for (const c of projectImplementation(PKG, state, pilotBindings(state)).channels) {
      assert.equal(/\{\{|\[omit |\{policy\./.test(c.text), false, `${state}/${c.channel}: a placeholder reached the page`)
      for (const r of c.requests) assert.equal(/\{/.test(r.endpoint), false, `${state}/${c.channel}: an unbound endpoint`)
      if (c.channel === 'json') for (const body of c.text.split(/\n\n(?=\{)/)) JSON.parse(body)
    }
  }
})

// --------------------------------------------------------------------- readiness

test('Readiness: Exclusions is Ready only from the resolved canonical set, never from the absence of a problem', () => {
  const tile = (state: PackageState, over: Record<string, unknown> = {}) => packageReadiness(PKG, state, pilotBindings(state, over))!.tiles.find((t) => t.id === 'readiness.exclusions')!
  const ready = tile('readyToEnforce')
  assert.equal(ready.result, 'Ready')
  assert.equal(ready.line, 'IAMAI has the canonical exclusions this policy must preserve.')
  assert.equal(tile('readyToEnforce', { 'policy.target.excludeGroups': undefined }).result, 'Blocked')
  assert.equal(tile('readyToEnforce', { 'policy.target.excludeGroups': [] }).result, 'Blocked')
  const r = packageReadiness(PKG, 'readyToEnforce', pilotBindings('readyToEnforce'))!
  // Evidence IAMAI does not hold is Unknown, and the human checks IAMAI keeps no record of are never Ready.
  assert.equal(r.tiles.find((t) => t.id === 'readiness.enrollment-workflows')!.result, 'Unknown')
  assert.equal(r.tiles.find((t) => t.id === 'readiness.enforcement-settings')!.result, 'Review required')
  assert.equal(r.conclusion, 'Enforce only after enrollment workflows pass, external-authentication compatibility is resolved, and the legacy device-registration MFA toggle is confirmed No.')
  assert.ok(r.references.every((s) => s.userFacing === true))
})

// ------------------------------------------------------------------- source date

test('the source date comes from the package’s verified sources, never a clock', () => {
  assert.equal(sourceUpdatedOn(PKG), '2026-09-10')
  const later = structuredClone(PKG)
  later.meta.verifiedSources = [...(later.meta.verifiedSources ?? []), { id: 'x', title: 'x', url: 'https://learn.microsoft.com/x', checkedOn: '2026-10-01', userFacing: true }, { id: 'y', title: 'y', url: 'https://learn.microsoft.com/y', checkedOn: '2027-01-01', userFacing: false }]
  assert.equal(sourceUpdatedOn(later), '2026-10-01', 'the latest user-facing source is not the date, or a research-only source moved it')
  const code = read('src/content/implementation/project.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const clock of ['Date.now', 'new Date(', 'performance.now', 'mtime', 'import.meta.env']) assert.equal(code.includes(clock), false, `project.ts reads ${clock}`)
  const step = read('src/ui/surfaces/ContentStep.tsx')
  assert.match(step, /const sourceLine = sourceOn \? fillText\(W\.sourceUpdated, \{ date: absoluteDate\(`\$\{sourceOn\}T12:00:00Z`\) \}\) : null/)
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
  assert.equal(packageStateOf(step, c), 'blocked')
  assert.deepEqual(projectImplementation(PKG, 'blocked', packageBindings(step, ctx, c)).channels, [])
})

test('a real fixture step at Ready to enforce reaches all five channels through the runtime adapter', () => {
  const { step: base, ctx } = stepAndContext('small')
  const step = pilotStepAt(base, 'readyToEnforce')
  const c = stepContract(step, ctx)
  assert.equal(c.state.lifecycle, 'ready-to-enforce')
  assert.equal(c.implementation.offered, true)
  assert.equal(packageStateOf(step, c), 'readyToEnforce')
  const bindings = packageBindings(step, ctx, c)
  assert.equal(bindings['policy.current.id'], PILOT_IDS.policy)
  assert.ok(Array.isArray(bindings['policy.target.excludeGroups']) && (bindings['policy.target.excludeGroups'] as string[]).length > 0)
  assert.equal(bindings['policy.current.semanticMismatches'], undefined, 'a semantic-mismatch list was invented')
  const p = projectImplementation(PKG, 'readyToEnforce', bindings)
  assert.equal(p.hold, null)
  assert.deepEqual(p.channels.map((x) => x.channel), ['entra', 'powershell', 'json', 'aiInfo', 'email'])
  // The Exclusions gate reaches the page's Readiness, positively.
  const merged = mergeReadiness(readinessOf(step, c), packageReadiness(PKG, 'readyToEnforce', bindings))
  assert.ok(merged.tiles.length <= 3)
  assert.equal(merged.tiles.find((t) => t.key === 'readiness.exclusions')?.value, 'Ready')
  // And Missing is Create, from the same step.
  const missing = pilotStepAt(base, 'missing')
  assert.equal(packageStateOf(missing, stepContract(missing, ctx)), 'missing')
})

test('where Foundation A withholds the operation, the target is unresolved and Exclusions is not Ready', () => {
  // The demo's source policy leaves out groups IAMAI cannot identify, so no
  // operation is handed over and no canonical exclusion set is resolved.
  const { step, ctx } = stepAndContext('demo')
  const c = stepContract(step, ctx)
  const bindings = packageBindings(step, ctx, c)
  assert.equal(bindings['policy.target.excludeGroups'], undefined)
  const state = packageStateOf(step, c)!
  const tile = packageReadiness(PKG, state, bindings)!.tiles.find((t) => t.id === 'readiness.exclusions')!
  assert.equal(tile.result, 'Blocked')
})

// ------------------------------------------------------------------------ viewer

test('the viewer draws every package channel through the one Implementation region', () => {
  const step = read('src/ui/surfaces/ContentStep.tsx')
  const ids = [...(step.match(/const CHANNEL_TABS: TabItem\[\] = \[[\s\S]*?\]/)?.[0] ?? '').matchAll(/id: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ids, ['portal', 'ps', 'json', 'ai', 'email'], 'Email is not the fifth member of the one selector')
  assert.match(step, /const PACKAGE_CHANNEL: Record<OutputChannel, Channel> = \{ entra: 'portal', powershell: 'ps', json: 'json', aiInfo: 'ai', email: 'email' \}/)
  // One region, one preview, one Copy through the export guard, one Expand.
  assert.equal(step.split('<Implementation\n').length - 1, 1)
  assert.match(step, /onClick=\{\(\) => copy\('implementation', active\?\.text\(\) \?\? ''\)\}/)
  assert.match(step, /exportClipboard\(text, REDACTED\)/)
  // The tenant-context warning stays on the AI channel, in the preview and in the expanded viewer.
  assert.equal(step.split("{tab === 'ai' && (").length - 1, 2)
  // A package step never also draws the channels it had before.
  assert.match(step, /const artifacts: Artifact\[\] = pkg\n\s*\? \(projection\?\.channels \?\? \[\]\)\.map\(packageArtifact\)/)
})
