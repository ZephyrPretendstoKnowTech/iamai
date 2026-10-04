// v1.1 T1-5: 4.3 Require Phishing-Resistant MFA for Admins' session and name
// correction lines (v1.1 list, "Package correction modules").
//
// Session. The review (2026-09-24) saw a tenant's own admin policy with a
// 4-hour sign-in frequency raise no session correction. Then, tracking read a
// policy coverage counted for the goal with its grant and session judged by
// coverage (observation.ts COVERAGE_JUDGED), and a sign-in frequency on a
// policy that meets the admins' floor is no coverage gap, so the difference
// was never compared. Exact controls (8964bee3, 2026-09-25; a8afd18b,
// 2026-09-26) compare every dimension: the step raises the session correction
// as a correction a person makes in Entra, or accepts. This locks that in, in
// Report-only and On.
//
// Since the policy-matching pilot (T4-PM; owner, 2026-09-27: build new, retire
// old) 4.3 corrects only the plan's own policy, the one carrying the baseline's
// name or the plan's tag: the policy here carries the baseline's name. A policy
// under a name of the tenant's own is never corrected (adminsBuildBeside.test.ts).
//
// Name. The package's name module declared no facts and no select condition,
// so IAMAI could never select it (protocol.ts: "cannot select this module"),
// and a renamed tagged policy is adopted under its new name, with renames in
// 8.2 Align Policy Names (owner, 2026-09-26). It is gone from the package.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { asCuratedBaseline, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import registry from '../content/implementation/registry.generated.json' with { type: 'json' }
import { normalizeProjection, parseBlocks, validatePackage } from '../content/implementation/protocol.ts'
import type { PackageMeta } from '../content/implementation/protocol.ts'

const ADMINS = 's-goal-admins-phishing-resistant'
const FOUR_HOURS = { signInFrequency: { value: 4, type: 'hours', isEnabled: true, authenticationType: 'primaryAndSecondaryAuthentication', frequencyInterval: 'timeBased' } }

/** The plan's own admin MFA policy, built by hand: the plan's policy under the baseline's name, untagged, with a 4-hour sign-in frequency, in the state given. */
function tenantPolicy(state: string): { g: Fixture; name: string } {
  const f = withFoundationSettled({ ...fixture('small'), baseline: asCuratedBaseline(pinnedPackage() as never) })
  const op = runFixture(f).steps.find((s) => s.id === ADMINS)!.action.resolution!.policies[0]
  assert.equal(op.mode, 'create', 'the premise: the tenant has no admin policy yet')
  const g = structuredClone(f)
  const { description: _tag, ...body } = structuredClone(op.body) as Record<string, unknown>
  const name = String(body.displayName)
  ;(g.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).push({ ...body, displayName: name, sessionControls: FOUR_HOURS, id: 'c0100000-0000-4000-8000-0000000000a1', state, createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf })
  return { g, name }
}

for (const state of ['enabledForReportingButNotEnforced', 'enabled']) {
  test(`4.3 raises the session correction for the plan's own admin policy with a 4-hour sign-in frequency (${state})`, () => {
    const { g, name } = tenantPolicy(state)
    const r = runFixture(g, { snapshot: g.snapshot } as never)
    const step = r.steps.find((s) => s.id === ADMINS)!
    assert.equal(step.tracking?.members?.[0]?.policyName, name, "the premise: the step reads the plan's own policy")
    assert.deepEqual([...new Set(step.state.members.flatMap((m) => [...m.change.unwritten]))], ['sessionControls'])
    assert.equal(step.state.satisfied, false)
    const ctx: StepVarContext = { snapshot: g.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: g.operatorId, now: g.snapshot.asOf, groups: g.groups }
    const body = stepBodyOf(step, ctx)
    assert.ok(body.readiness.tiles.some((t) => /Session/.test(t.label)), `a Tasks Remaining card names the session: ${JSON.stringify(body.readiness.tiles.map((t) => t.label))}`)
    const portal = body.artifacts.find((a) => a.id === 'portal')!.text()
    const correct = portal.slice(portal.indexOf('**Correct the policy**'))
    assert.ok(portal.includes('**Correct the policy**'), portal)
    assert.ok(correct.includes(name), correct)
    assert.match(correct, /Under \*\*Session\*\*, clear every control\. Yours is stricter than the baseline here: to keep it, accept the difference instead\./)
  })
}

test("4.3's package has no name module: its correction modules are conditions, grant and session, and none is unselectable", () => {
  const pkg = (registry as unknown as { packages: Record<string, { meta: { projection: { partial: { mismatches: Record<string, unknown> } } }; blocks: Record<string, { text: string }> }> }).packages[ADMINS]
  assert.deepEqual(Object.keys(pkg.meta.projection.partial.mismatches), ['conditions.canonical', 'grant.custom-strength', 'session.none'])
  assert.deepEqual(Object.keys(pkg.blocks).filter((id) => /name/.test(id)), [])
  assert.doesNotMatch(pkg.blocks['powershell.run'].text, /CorrectName/)
  // The source package itself, as authored: the validator finds no module IAMAI cannot select.
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../docs/implementation-content', ADMINS, ADMINS)
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'META.json'), 'utf8')) as PackageMeta
  const blocks = parseBlocks(fs.readFileSync(path.join(dir, 'CONTENT.md'), 'utf8'))
  const errors = validatePackage({ meta: { ...meta, projection: normalizeProjection(meta, blocks) }, blocks })
  assert.deepEqual(errors.filter((e) => /cannot select this module|name\.canonical|correct-name/.test(e)), [])
})
