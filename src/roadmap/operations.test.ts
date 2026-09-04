// Foundation A: the step's operations are the authority. A channel that read
// anything else — a body left over in `action.json`, a mode that disagrees with
// its target — could describe a policy the operations do not, so none of them
// does: the JSON, the PowerShell and the download all serialise the operations,
// and an operation that does not say exactly one thing is no operation at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidOperation, operationsOf, implementationOffered, unavailableReason, validOperations } from './operations.ts'
import type { PolicyOperation, Step } from './types.ts'
import { jsonOffered, policyJson, policyJsonText, stepOperations } from '../ui/surfaces/stepJson.ts'
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { buildTranslatorOutput } from '../../scripts/translator-dump.ts'
import { canDenyAccess } from './strand.ts'
import { stepExportView, commsFor } from '../ui/surfaces/stepExport.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { rowWhen } from '../ui/surfaces/rowWhen.ts'
import { planFinish } from '../derive/finish.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
  assert.equal(unavailableReason(missing), 'missing-object')
  const unmatched = stepWith([CREATE], null)
  unmatched.action.unmatchedPair = true
  assert.equal(unavailableReason(unmatched), 'unmatched-pair')
  const conflicted = { ...stepWith([CREATE], null), goalId: 'admin-portals-protected' } as Step
  assert.equal(unavailableReason(conflicted), 'baseline-conflict')
  for (const s of [missing, unmatched, conflicted]) {
    assert.equal(implementationOffered(s), false, `${unavailableReason(s)}: no implementation`)
    assert.deepEqual(stepOperations(s), [], `${unavailableReason(s)}: no operation to run`)
    assert.equal(jsonOffered(s), false)
  }
  // A step with nothing stopping it is implementable.
  assert.equal(unavailableReason(stepWith([CREATE], '{}')), null)
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
  const held = r.steps.filter((s) => (s.kind === 'create' || s.kind === 'adjust') && unavailableReason(s) !== null)
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


// ---- A + B: an open policy with nothing valid to run is unavailable everywhere ----

/** The demo's week two, with the tenant's own policies replaced and the mapping overridden. */
function demoRun(rows: Record<string, unknown>[] = [], mappingOver: Record<string, unknown> = {}, snapshotOver: (f: ReturnType<typeof fixture>) => Record<string, unknown> = () => ({})) {
  const f = fixture('demo-week2')
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } }, ...snapshotOver(f) } as typeof f.snapshot
  const mapping = { ...f.mapping, ...mappingOver } as typeof f.mapping
  const r = runFixture({ ...f, snapshot, mapping }, { snapshot, mapping } as never)
  const ctx: StepVarContext = { snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { f, r, ctx, snapshot, mapping }
}

/** Everything a step that cannot be written must not carry, on every surface. */
function assertNothingRollsOut(step: Step, ctx: StepVarContext, label: string): void {
  assert.equal(implementationOffered(step), false, `${label}: no implementation`)
  assert.equal(jsonOffered(step), false, `${label}: no JSON, PowerShell or download`)
  assert.deepEqual(stepOperations(step), [], `${label}: no operation to run`)
  assert.equal(stepPortalLines(step, { nameOf: (id) => id, policyName: step.title }), null, `${label}: no portal instructions`)
  assert.ok(!step.events, `${label}: no enforcement or announcement event`)
  assert.deepEqual(step.rings, [], `${label}: no rings`)
  assert.equal(rowWhen(step, '2026-09-08T00:00:00.000Z'), '', `${label}: the row takes no date from its wave`)
  const view = stepExportView(step, ctx)
  assert.deepEqual(view.doneWhen, [], `${label}: no completion criteria`)
  assert.equal(view.ifWrong, null, `${label}: no rollback`)
  assert.equal(view.dates, null, `${label}: no dates`)
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  if (cs) assert.equal(commsFor(cs, stepVars(step, ctx) as Record<string, unknown>), null, `${label}: nothing announced`)
}

test('A: an open policy whose operations are gone offers nothing and rolls nothing out, whatever its body says', () => {
  const { r, ctx } = demoRun()
  const live = r.steps.find((s) => s.goalId === 'admin-session' && s.kind !== 'verify')!
  assert.equal(implementationOffered(live), true, 'it is implementable to begin with')
  // A step from an older plan file: a body left behind, and no operations.
  const legacy = { ...live, action: { ...live.action, json: '{"displayName":"from an older plan file"}', resolution: undefined }, rings: [], events: undefined } as unknown as Step
  assert.equal(unavailableReason(legacy), 'no-operation')
  assertNothingRollsOut(legacy, ctx, 'no operation')
  assert.ok(!policyJsonText(legacy).includes('older plan file'), 'the leftover body reaches no channel')
  // The step still says what to do about it.
  const view = stepExportView(legacy, ctx)
  assert.ok(view.whatToDo.length > 0, 'the step still says something')
})

test('B: one invalid operation in a set makes the whole step unavailable', () => {
  const { r, ctx } = demoRun()
  const live = r.steps.find((s) => s.goalId === 'admin-session' && s.kind !== 'verify')!
  const ops = live.action.resolution!.policies
  const broken = { ...ops[0], mode: 'update' as const, policyId: '' } as unknown as PolicyOperation
  const step = { ...live, action: { ...live.action, resolution: { ...live.action.resolution!, policies: [...ops, broken] } }, rings: [], events: undefined } as unknown as Step
  assert.equal(unavailableReason(step), 'no-operation', 'one invalid operation invalidates the set')
  assertNothingRollsOut(step, ctx, 'invalid operation')
})

// ---- C: no implementation text leaks while the policy cannot be written ----

test('C: a policy waiting on an object exports only its next action — no lead, no before line', () => {
  const { r, ctx } = demoRun()
  const step = r.steps.find((s) => s.goalId === 'require-managed-device' && s.kind !== 'verify')!
  assert.equal(unavailableReason(step), 'missing-object')
  const cs = contentStepFor(step) as unknown as { whatToDo?: { before?: string[] } }
  const before = cs.whatToDo?.before ?? []
  assert.ok(before.length > 0, 'the step has a before line to leak')
  const view = stepExportView(step, ctx)
  for (const l of before) assert.ok(!view.whatToDo.some((x) => x.startsWith(l.split('{')[0].slice(0, 30))), `the before line does not leak: ${l.slice(0, 40)}`)
  assert.ok(!view.whatToDo.some((x) => /Conditional Access → Policies/.test(x)), 'no portal instruction leaks')
  assert.equal(view.whatToDo.length, 1, `only the next action: ${view.whatToDo.join(' | ')}`)
  assert.match(view.whatToDo[0], /first: this policy names an object/)
})

// ---- D: what a step can deny comes from its operations ----

test('D: impact follows the operation’s final target, not a body left beside it', () => {
  const { r } = demoRun()
  const live = r.steps.find((s) => s.goalId === 'admin-session' && s.kind !== 'verify')!
  assert.equal(canDenyAccess(live), true, 'a session control can interrupt someone')
  // A body that says the opposite of the operation changes nothing.
  const contradicted = { ...live, action: { ...live.action, json: '{"grantControls":null,"sessionControls":null}' } } as unknown as Step
  assert.equal(canDenyAccess(contradicted), true, 'the stale body is not consulted')
  // Take the operations away and the goal family decides, as it always did.
  const noOps = { ...live, action: { ...live.action, resolution: undefined }, readiness: { ...live.readiness, family: 'other' as const } } as unknown as Step
  assert.equal(canDenyAccess(noOps), false)
})

// ---- E: an update that turns a policy on says so everywhere ----

test('E: report-only → enabled is enabled in the body, in the target, in the instruction and in the command', () => {
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  const memberA = {
    id: 'p-guests-a',
    displayName: 'CA - Require - MFA for guests and external users',
    state: 'enabledForReportingButNotEnforced',
    createdDateTime: '2026-01-10T00:00:00Z',
    conditions: {
      users: { includeUsers: ['All'], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,internalGuest,serviceProvider,otherExternalUser', externalTenants: { membershipKind: 'all' } }, excludeGroups: exclusions ? [exclusions] : [] },
      applications: { includeApplications: ['All'] },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: null,
  }
  const { r, ctx } = demoRun([memberA])
  const step = r.steps.find((s) => s.goalId === 'guests-mfa' && s.kind !== 'verify')!
  assert.equal(implementationOffered(step), true)
  const update = stepOperations(step).find((o) => o.mode === 'update')
  assert.ok(update, 'the half the tenant has is an update')
  assert.equal(update.body.state, 'enabled', 'the submitted body turns it on')
  assert.equal((update.target as Record<string, unknown>).state, 'enabled', 'and so does the policy it leaves behind')
  const bodies = policyJson(step) as Record<string, unknown>[]
  assert.ok(bodies.some((b) => b.state === 'enabled'), 'the JSON agrees')
  assert.equal(policyJsonText(step), JSON.stringify(bodies, null, 2), 'the download agrees')
  const ps = powershellFor(stepOperations(step))
  assert.ok(ps.includes('"state": "enabled"'), 'the PowerShell submits enabled')
  const portal = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)) ?? []
  assert.ok(portal.some((l) => /Enable policy: On → Save/.test(l)), `the instruction says to turn it on: ${portal.join(' | ')}`)
})

// ---- F: the strength the operation names is the strength the instruction names ----

test('F: a confirmed authentication strength is the tenant’s object on every channel', () => {
  const AUTHOR = '42de22a7-5339-4a58-b560-28565d53b14d'
  const TENANT = '00000000-9999-4000-8000-000000000042'
  const record = { placeholder: AUTHOR, kind: 'authenticationStrength', group: 'placeholders' as const, resolvedId: TENANT, resolvedName: 'Contoso passkeys', provenance: 'confirmed' as const, doesNotExist: false, validation: null }
  const base = fixture('demo-week2')
  const { r, ctx } = demoRun([], { records: { ...base.mapping.records, [AUTHOR]: record } }, (f) => {
    const strengths = f.snapshot.config.authStrengths ?? { status: 'ok' as const, reason: null, rows: [] }
    return { config: { ...f.snapshot.config, caPolicies: { ...(f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }), rows: [] }, authStrengths: { ...strengths, rows: [...(strengths.rows ?? []), { id: TENANT, displayName: 'Contoso passkeys', allowedCombinations: ['fido2', 'windowsHelloForBusiness'] }] } } }
  })
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant' && s.kind !== 'verify')!
  assert.equal(implementationOffered(step), true)
  const body = policyJson(step) as Record<string, unknown>
  const strength = (body.grantControls as Record<string, Record<string, unknown>>).authenticationStrength
  assert.equal(strength.id, TENANT, 'the operation carries the tenant’s strength, not the author’s')
  assert.equal(strength.displayName, 'Contoso passkeys', 'named as the tenant knows it')
  const portal = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)) ?? []
  assert.ok(portal.some((l) => l === 'Grant → Require authentication strength: Contoso passkeys'), `the instruction names the tenant’s object: ${portal.join(' | ')}`)
  assert.ok(!portal.some((l) => /Modern MFA \+ TAP/.test(l)), 'never the author’s name for it')
  assert.ok(powershellFor(stepOperations(step)).includes(TENANT), 'the PowerShell carries the tenant id')
  assert.ok(policyJsonText(step).includes(TENANT), 'and so does the download')
})

// ---- I: the boundary stays closed ----

test('I: no production module reads action.json to decide what a policy means', () => {
  // `action.json` is a derived projection the engine writes for the plan file and
  // the exports. If a semantic read of it comes back, this fails: the channels,
  // the schedule and the impact analysis read the operations (operations.ts).
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.')) continue
      for (const [i, line] of readFileSync(full, 'utf8').split('\n').entries()) {
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
        if (/\baction\??\.json\b/.test(code)) offenders.push(`${full}:${i + 1}: ${code.slice(0, 90)}`)
      }
    }
  }
  walk('src')
  assert.deepEqual(offenders, [], 'the operations are the authority; action.json is written, never read for meaning')
})
