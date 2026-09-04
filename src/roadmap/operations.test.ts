// Foundation A: the step's operations are the authority. A channel that read
// anything else — a body left over in `action.json`, a mode that disagrees with
// its target — could describe a policy the operations do not, so none of them
// does: the JSON, the PowerShell and the download all serialise the operations,
// and an operation that does not say exactly one thing is no operation at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidOperation, operationsOf, implementationOffered, unimplementableReason, validOperations } from './operations.ts'
import type { PolicyOperation, Step } from './types.ts'
import { jsonOffered, policyJson, policyJsonText, stepOperations } from '../ui/surfaces/stepJson.ts'
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { buildTranslatorOutput } from '../../scripts/translator-dump.ts'

const CREATE: PolicyOperation = { sourceName: 'author', mode: 'create', policyId: null, body: { displayName: 'A' } }
const UPDATE: PolicyOperation = { sourceName: 'author', mode: 'update', policyId: 'p-1', body: { state: 'enabled' } }

/** A step carrying the operations given, with whatever `action.json` the caller wants to plant. */
const stepWith = (ops: PolicyOperation[], json: string | null): Step =>
  ({ id: 's-x', goalId: 'block-legacy-auth', action: { kind: 'create', summary: [], portalSteps: [], json, missing: [], resolution: { policies: ops, tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null } } } }) as unknown as Step

// ---- 2 + 3: a create and an update are different things ----

test('an operation is valid only when its mode and its target agree', () => {
  assert.equal(isValidOperation(CREATE), true)
  assert.equal(isValidOperation(UPDATE), true)
  // An update with nothing to update, and an update with nothing to change.
  assert.equal(isValidOperation({ ...UPDATE, policyId: '' } as unknown as PolicyOperation), false)
  assert.equal(isValidOperation({ ...UPDATE, policyId: null } as unknown as PolicyOperation), false)
  assert.equal(isValidOperation({ ...UPDATE, body: {} }), false)
  // A create that names a tenant policy is not a create.
  assert.equal(isValidOperation({ ...CREATE, policyId: 'p-1' } as unknown as PolicyOperation), false)
  assert.equal(isValidOperation({ ...CREATE, mode: 'delete' } as unknown as PolicyOperation), false)
  assert.equal(isValidOperation(undefined), false)
})

test('an invalid update is never turned into a create, and it offers no channel', () => {
  const broken = { ...UPDATE, policyId: null } as unknown as PolicyOperation
  const step = stepWith([broken], JSON.stringify({ state: 'enabled' }, null, 2))
  // The command that would have written a second policy is not produced.
  const ps = powershellFor([broken])
  assert.ok(!ps.includes('New-MgIdentityConditionalAccessPolicy'), `no create command: ${ps}`)
  assert.ok(!ps.includes('Update-MgIdentityConditionalAccessPolicy'), 'and no update command either')
  assert.equal(ps.trim(), 'Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', 'nothing to run')
  // And no channel offers it, whatever `action.json` says.
  assert.deepEqual(validOperations(step.action), [], 'one invalid operation invalidates the set')
  assert.equal(implementationOffered(step), false)
  assert.equal(jsonOffered(step), false)
  assert.deepEqual(stepOperations(step), [])
  assert.deepEqual(policyJson(step), { note: 'Portal steps show the policy to create.' })
  assert.equal(stepPortalLines(step, { nameOf: (id) => id, policyName: 'x' }), null)
})

// ---- 1 + 4: the operations are the authority ----

test('a step with a body but no operations offers none of the four channels', () => {
  const legacy = stepWith([], JSON.stringify({ displayName: 'from an older plan file' }, null, 2))
  assert.equal(implementationOffered(legacy), false, 'a body alone is not an operation')
  assert.equal(jsonOffered(legacy), false)
  assert.deepEqual(stepOperations(legacy), [])
  assert.deepEqual(policyJson(legacy), { note: 'Portal steps show the policy to create.' })
  assert.ok(!policyJsonText(legacy).includes('from an older plan file'), 'nothing downloadable comes from it')
  assert.equal(stepPortalLines(legacy, { nameOf: (id) => id, policyName: 'x' }), null)
  assert.equal(powershellFor(stepOperations(legacy)).trim(), 'Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess')
})

test('a stale action.json cannot make the JSON or the download disagree with the operations', () => {
  const step = stepWith([CREATE], JSON.stringify({ displayName: 'STALE — a body nobody resolved' }, null, 2))
  assert.equal(implementationOffered(step), true)
  assert.deepEqual(policyJson(step), CREATE.body, 'the JSON is the operation body')
  assert.equal(policyJsonText(step), JSON.stringify(CREATE.body, null, 2), 'and so is the download')
  assert.ok(!policyJsonText(step).includes('STALE'), 'the leftover body reaches no channel')
  assert.ok(!powershellFor(stepOperations(step)).includes('STALE'), 'nor the PowerShell')
})

test('two operations are two bodies, in the step’s order, on every channel', () => {
  const a: PolicyOperation = { sourceName: 'A', mode: 'create', policyId: null, body: { displayName: 'A' } }
  const b: PolicyOperation = { sourceName: 'B', mode: 'update', policyId: 'p-b', body: { state: 'enabled' } }
  const step = stepWith([a, b], '{"displayName":"stale"}')
  assert.deepEqual(policyJson(step), [a.body, b.body])
  assert.equal(policyJsonText(step), JSON.stringify([a.body, b.body], null, 2))
  const ps = powershellFor(operationsOf(step))
  assert.equal((ps.match(/New-MgIdentityConditionalAccessPolicy/g) ?? []).length, 1)
  assert.ok(ps.includes("Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId 'p-b'"))
  assert.ok(ps.indexOf('$bodyA') < ps.indexOf('$bodyB'), 'in the step’s order')
})

// ---- 6: the three reasons a policy cannot be implemented ----

test('the three non-implementable reasons are named, and each stops the same things', () => {
  const missing = stepWith([CREATE], null)
  missing.action.missing = [{ token: 'g-1', stepId: 's-prereq-exclusion-group' }]
  assert.equal(unimplementableReason(missing), 'missing-object')
  const unmatched = stepWith([CREATE], null)
  unmatched.action.unmatchedPair = true
  assert.equal(unimplementableReason(unmatched), 'unmatched-pair')
  const conflicted = { ...stepWith([CREATE], null), goalId: 'admin-portals-protected' } as Step
  assert.equal(unimplementableReason(conflicted), 'baseline-conflict')
  for (const s of [missing, unmatched, conflicted]) {
    assert.equal(implementationOffered(s), false, `${unimplementableReason(s)}: no implementation`)
    assert.deepEqual(stepOperations(s), [], `${unimplementableReason(s)}: no operation to run`)
    assert.equal(jsonOffered(s), false)
  }
  // A step with nothing stopping it is implementable.
  assert.equal(unimplementableReason(stepWith([CREATE], '{}')), null)
})

// ---- 7: the review page's translations still render ----

test('the translator output is not empty, and holds a single-policy and a paired-policy translation', () => {
  const out = buildTranslatorOutput()
  const ids = Object.keys(out)
  assert.ok(ids.length >= 10, `the review page has translations (${ids.length})`)
  for (const [id, v] of Object.entries(out)) {
    assert.ok(v.steps.length > 0, `${id}: the translation has lines`)
    assert.ok(v.steps[0].includes('Conditional Access'), `${id}: it opens in the portal — ${v.steps[0]}`)
  }
  // A goal the baseline implements with two policies renders both blocks.
  const pair = Object.entries(out).find(([, v]) => v.steps.filter((l) => /^Policy [AB] — /.test(l)).length === 2)
  assert.ok(pair, `a paired-policy translation renders two blocks (${ids.join(', ')})`)
  const single = Object.entries(out).find(([, v]) => !v.steps.some((l) => /^Policy [AB] — /.test(l)))
  assert.ok(single, 'and a single-policy translation renders one')
})

// ---- the plan around a step that cannot be written stays usable ----

test('a step the plan cannot write is not scheduled, and the rest of the plan is', () => {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  const held = r.steps.filter((s) => (s.kind === 'create' || s.kind === 'adjust') && unimplementableReason(s) !== null)
  assert.ok(held.length >= 2, `the demo holds policies it cannot write yet (${held.length})`)
  for (const s of held) {
    // It stays in the foundation wave so the plan still shows it, and in no
    // enforcement wave: no start, no report-only date, no rings, no events.
    assert.equal(r.schedule.waveOf[s.id], 0, `${s.id}: no enforcement wave`)
    assert.equal(r.schedule.startAt[s.id], undefined, `${s.id}: no start`)
    assert.equal(r.schedule.reportOnlyAt[s.id], undefined, `${s.id}: no report-only date`)
    assert.deepEqual(s.rings, [], `${s.id}: no rings`)
    assert.ok(!s.events, `${s.id}: no enforcement or announcement`)
    assert.equal(stepPortalLines(s, portalNamesFor(ctx, stepVars(s, ctx) as Record<string, unknown>, s.title)), null, `${s.id}: no instructions`)
  }
  // The rest of the plan is still placed and dated.
  const running = r.steps.filter((s) => (s.kind === 'create' || s.kind === 'adjust') && implementationOffered(s))
  assert.ok(running.length >= 4, `the plan still has policies to write (${running.length})`)
  for (const s of running) assert.ok(typeof r.schedule.startAt[s.id] === 'string', `${s.id}: dated`)
  assert.ok(r.schedule.waves.length > 0, 'the plan still has waves')
})
