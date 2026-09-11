// Device Registration MFA against the pin the build carries (correction batch 1).
//
// The re-pinned member requires the author's custom strength — Windows Hello for
// Business, FIDO2, certificate-based MFA and a one-time Temporary Access Pass —
// where it used to require the built-in Multifactor authentication strength. The
// package was authored against the old member. Every channel now carries the one
// strength IAMAI resolved for this tenant, the same exclusions, and nothing of the
// old pin, the author's tenant or the package's own block names.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { NO_RUNTIME, packageReadiness, projectSafely } from './project.ts'
import { PINNED } from '../../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { packageBindings, packageRuntime, packageStateOf } from '../../ui/surfaces/stepPackage.ts'
import { pilotStepAt } from '../../testing/pilotFixture.ts'

const STEP_ID = 's-goal-device-registration-mfa'
const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages[STEP_ID]
const MEMBER = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const OLD_PIN = '8461e0f2'
const BUILT_IN_MFA = '00000000-0000-0000-0000-000000000002'

/**
 * The demo's device-registration step, which renders from the pinned member (a
 * fixture with no baseline renders the goal's own template instead), moved to
 * Missing so every channel projects.
 */
function missingStep() {
  const f = fixture('demo')
  const r = runFixture(f)
  const step = pilotStepAt(r.steps.find((s) => s.id === STEP_ID)!, 'missing')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  const bindings = packageBindings(step, ctx, c)
  const state = packageStateOf(step, c, f.snapshot)!
  const { runtime } = packageRuntime(PKG, state, bindings, {})
  return { step, bindings, state, runtime, projection: projectSafely(PKG, state, bindings, runtime) }
}

test('the package states no retained old pin as current and claims no exclusion resolved before it is', () => {
  const dir = 'docs/implementation-content/s-goal-device-registration-mfa'
  const sources = ['STEP.md', 'CONTENT.md', 'META.json'].map((file) => [file, readFileSync(`${dir}/${file}`, 'utf8')] as const)
  for (const [file, text] of [...sources, ['registry', Object.values(PKG.blocks).map((b) => b.text).join('\n')] as const]) {
    assert.doesNotMatch(text, /retained pinned|retained pin\b|historical pinned/i, `${file} describes a retained pin as the target`)
    assert.doesNotMatch(text, /already resolved/i, `${file} claims values are resolved before the answers they wait on`)
  }
  // The old pin survives only as the history of the re-authoring.
  const meta = JSON.parse(sources[2][1]) as { baselineAuthority: { pinCommit: string; reauthored: { from: string } } }
  assert.equal(meta.baselineAuthority.pinCommit, PINNED.commit)
  const mentions = sources.flatMap(([file, text]) => text.split('\n').filter((l) => l.includes(OLD_PIN)).map((l) => `${file}: ${l.trim().slice(0, 60)}`))
  assert.equal(mentions.length, 2, mentions.join('\n'))
})

test('the package names the pin the build carries, the member the goal maps to, and the requirement the member now asks for', () => {
  const authority = PKG.meta.baselineAuthority as { pinCommit: string; memberStableId: string; reauthored: { from: string }; authenticationStrength: { requirement: string[]; binding: string } }
  assert.equal(authority.pinCommit, PINNED.commit)
  assert.ok(authority.reauthored.from.startsWith(OLD_PIN))
  assert.deepEqual(PINNED_GOAL_MAP['device-registration-mfa'], [authority.memberStableId])
  const member = PINNED.policies.find((p) => p.id === MEMBER) as { grantControls: { authenticationStrength: { allowedCombinations: string[] } } }
  assert.deepEqual([...authority.authenticationStrength.requirement].sort(), [...member.grantControls.authenticationStrength.allowedCombinations].sort())
  assert.equal(authority.authenticationStrength.binding, 'authStrength.target.id')
})

test('Entra, JSON, PowerShell and AI Info carry the one strength IAMAI resolved for this tenant, and the same exclusions', () => {
  const { step, bindings, state, projection } = missingStep()
  assert.equal(state, 'missing')
  assert.equal(projection.hold, null, JSON.stringify(projection.hold))
  assert.deepEqual(projection.channels.map((c) => c.channel), ['entra', 'powershell', 'json', 'aiInfo'])
  const resolved = operationsOf(step)[0].body as { grantControls: { authenticationStrength: { id: string } }; conditions: { users: { excludeGroups: string[] } } }
  const strength = resolved.grantControls.authenticationStrength.id
  assert.equal(bindings['authStrength.target.id'], strength)
  assert.notEqual(strength, BUILT_IN_MFA, 'the tenant strength for the pinned requirement is not the built-in one')
  const name = bindings['authStrength.target.displayName'] as string
  assert.ok(typeof name === 'string' && name.length > 0 && name !== strength, 'the strength has no name, or is named by its id')
  const text = (ch: string) => projection.channels.find((c) => c.channel === ch)!.text
  const json = JSON.parse(text('json')) as typeof resolved
  assert.equal(json.grantControls.authenticationStrength.id, strength)
  assert.deepEqual(json.conditions.users.excludeGroups, resolved.conditions.users.excludeGroups)
  assert.ok(text('powershell').includes(strength), 'the script does not run with the resolved strength')
  assert.ok(text('entra').includes(name), 'the portal steps do not name the strength to select')
  assert.ok(text('aiInfo').includes(strength) && text('aiInfo').includes(name))
})

test('no channel carries the old pin, the built-in strength, the author’s strength, a duplicated warning, or a block name', () => {
  const { projection } = missingStep()
  // The author's strength id is the author's; a tenant may name its own strength the same, so only the id is checked.
  const author = (PINNED.policies.find((p) => p.id === MEMBER) as { grantControls: { authenticationStrength: { id: string } } }).grantControls.authenticationStrength
  for (const c of projection.channels) {
    for (const stale of [OLD_PIN, BUILT_IN_MFA, author.id, 'Contains tenant context', 'newer upstream']) assert.equal(c.text.includes(stale), false, `${c.channel} still says ${stale}`)
    assert.doesNotMatch(c.text, /`(entra|json|powershell|ai|email)\.[a-z.-]+`/, `${c.channel} names a block`)
  }
  // The authored package text, every block, carries none of them either.
  for (const block of Object.values(PKG.blocks)) for (const stale of [OLD_PIN, BUILT_IN_MFA, author.id, 'Contains tenant context']) assert.equal(block.text.includes(stale), false, `${block.meta.id} still says ${stale}`)
})

test('readiness reads the strength on the pin the build carries: Ready once resolved, Blocked before', () => {
  const { bindings, state } = missingStep()
  const tile = (b: Record<string, unknown>) => packageReadiness(PKG, state, b, { ...NO_RUNTIME, baselineCommit: PINNED.commit })!.tiles.find((t) => t.id === 'readiness.authentication-strength')!
  assert.equal(tile(bindings).result, 'Ready')
  const { ['authStrength.target.id']: _id, ...without } = bindings
  assert.equal(tile(without).result, 'Blocked')
})
