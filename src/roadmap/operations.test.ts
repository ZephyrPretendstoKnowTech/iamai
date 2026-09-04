// Foundation A: the step's operations are the authority. A channel that read
// anything else — a body left over in `action.json`, a mode that disagrees with
// its target — could describe a policy the operations do not, so none of them
// does: the JSON, the PowerShell and the download all serialise the operations,
// and an operation that does not say exactly one thing is no operation at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { finalTargets, hasMalformedOperations, isPreserved, isValidOperation, operationsOf, implementationOffered, policyResult, unavailableReason, validOperations } from './operations.ts'
import { promptsPeople, wouldStrand } from './strand.ts'
import { batchClassOf } from './schedule.ts'
import { undatedRows } from '../ui/surfaces/planRows.ts'
import { buildSchedule } from './schedule.ts'
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
import { buildIcs } from './ics.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A create Graph would accept: a name, who it applies to, and something to do about them. */
const CREATE: PolicyOperation = { sourceName: 'author', mode: 'create', policyId: null, body: { displayName: 'A', conditions: { users: { includeUsers: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
const UPDATE: PolicyOperation = { sourceName: 'author', mode: 'update', policyId: 'p-1', body: { state: 'enabled' }, target: { id: 'p-1', displayName: 'the tenant’s own', state: 'enabled' } }

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
  const a: PolicyOperation = { sourceName: 'A', mode: 'create', policyId: null, body: { displayName: 'A', conditions: { users: { includeUsers: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
  const b: PolicyOperation = { sourceName: 'B', mode: 'update', policyId: 'p-b', body: { state: 'enabled' }, target: { id: 'p-b', displayName: 'B', state: 'enabled' } }
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
    // In no wave at all — the Plan renders it in its own undated group — and so
    // no start, no report-only date, no rings, no events.
    assert.equal(r.schedule.waveOf[s.id], undefined, `${s.id}: no wave`)
    assert.ok(!r.schedule.waves.some((w) => w.stepIds.includes(s.id)), `${s.id}: in no dated wave`)
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
  // The row takes nothing from the wave it might sit under: with a wave start
  // and without one, it reads the same, and it never reads as a plain date.
  const withWave = rowWhen(step, '2026-09-08T00:00:00.000Z')
  assert.equal(withWave, rowWhen(step, null), `${label}: the row takes no date from its wave`)
  assert.ok(!/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(withWave), `${label}: no rollout date on the row (${withWave})`)
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


// ---- the target is the tenant's own policy, patched ----

test('an update leaves the tenant’s untouched fields alone, and every channel reads the same final policy', () => {
  // The tenant's own admins policy, deliberately unlike the baseline's: its own
  // description, an extra session control, and an exclusion the baseline does
  // not name. Only its grant is weak, so only its grant is submitted.
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  const own = {
    id: 'p-admins',
    displayName: 'Core - Grant - Admins phishing-resistant',
    description: 'Owned by the identity team — do not rename',
    state: 'enabled',
    createdDateTime: '2026-01-10T00:00:00Z',
    conditions: { users: { includeRoles: ['62e90394-69f5-4237-9190-012177145e10'], excludeGroups: exclusions ? [exclusions] : [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: { persistentBrowser: { isEnabled: true, mode: 'never' } },
  }
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? own : p))
  const { r, ctx } = demoRun(rows)
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant' && s.kind !== 'verify')!
  assert.equal(implementationOffered(step), true)
  const op = stepOperations(step)[0]
  assert.equal(op.mode, 'update')
  assert.equal(op.policyId, 'p-admins')
  // The body is the one section that changes.
  assert.deepEqual(Object.keys(op.body).sort(), ['grantControls'])
  // The target is the tenant's policy with that patch applied: its own
  // description, its own session control and its own exclusions all survive.
  const target = op.target as Record<string, unknown>
  assert.equal(target.description, 'Owned by the identity team — do not rename', 'the tenant’s description is untouched')
  assert.deepEqual(target.sessionControls, own.sessionControls, 'the tenant’s session control is untouched')
  assert.deepEqual((target.conditions as Record<string, unknown>).users, own.conditions.users, 'the tenant’s users are untouched')
  assert.deepEqual(target.grantControls, op.body.grantControls, 'and the field the update submits is the new one')
  assert.notEqual(JSON.stringify(target.grantControls), JSON.stringify(own.grantControls), 'which is not what the tenant had')
  // Every channel reads that one operation.
  assert.deepEqual(policyJson(step), op.body)
  assert.equal(policyJsonText(step), JSON.stringify(op.body, null, 2))
  const ps = powershellFor(stepOperations(step))
  assert.ok(ps.includes("Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId 'p-admins'"))
  assert.ok(!ps.includes('do not rename'), 'the untouched description is not resubmitted')
  const portal = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)) ?? []
  assert.ok(portal.some((l) => /^Grant → /.test(l)), 'the instruction lists the field the body submits')
  assert.ok(!portal.some((l) => /^Session → /.test(l)), 'and nothing the tenant already has')
  // Impact reads the target, so the tenant's own session control counts.
  assert.equal(canDenyAccess(step), true)
})

test('an update with no complete target, or a target its body contradicts, makes the whole step unavailable', () => {
  const base: PolicyOperation = { sourceName: 'a', mode: 'update', policyId: 'p-1', body: { state: 'enabled' }, target: { id: 'p-1', displayName: 'x', state: 'enabled' } }
  assert.equal(isValidOperation(base), true)
  const noTarget = { ...base, target: undefined } as PolicyOperation
  const emptyTarget = { ...base, target: {} } as PolicyOperation
  const contradicted = { ...base, target: { id: 'p-1', displayName: 'x', state: 'enabledForReportingButNotEnforced' } } as PolicyOperation
  const wrongIdentity = { ...base, target: { ...base.target, id: 'p-another' } } as PolicyOperation
  const noIdentity = { ...base, target: { displayName: 'x', state: 'enabled' } } as PolicyOperation
  for (const [label, op] of [['no target', noTarget], ['empty target', emptyTarget], ['target disagrees', contradicted], ['target names another policy', wrongIdentity], ['target names no policy', noIdentity]] as [string, PolicyOperation][]) {
    assert.equal(isValidOperation(op), false, label)
    const step = stepWith([op], '{"state":"enabled"}')
    assert.equal(unavailableReason(step), 'no-operation', label)
    assert.equal(implementationOffered(step), false, label)
    assert.equal(jsonOffered(step), false, label)
    assert.deepEqual(finalTargets(step), [], label)
    assert.equal(powershellFor(stepOperations(step)).trim(), 'Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', label)
    assert.equal(canDenyAccess({ ...step, kind: 'adjust', status: 'ready', readiness: { family: 'mfa', percent: 100, lines: [] } } as unknown as Step), false, `${label}: no impact invented`)
  }
})

// ---- impact is the target's, not the family's ----

test('the goal family never overrules a policy’s own final target', () => {
  const quiet: PolicyOperation = { sourceName: 'a', mode: 'create', policyId: null, body: { displayName: 'a', conditions: { users: { includeUsers: ['All'] } }, sessionControls: { persistentBrowser: null } } }
  const denying: PolicyOperation = { sourceName: 'a', mode: 'create', policyId: null, body: { displayName: 'a', conditions: { users: { includeUsers: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
  const asStep = (op: PolicyOperation, family: string): Step =>
    ({ ...stepWith([op], '{}'), kind: 'create', status: 'ready', readiness: { family, percent: 100, lines: [] } }) as unknown as Step
  assert.equal(canDenyAccess(asStep(quiet, 'mfa')), false, 'a policy that denies nothing denies nothing, whatever its family says')
  assert.equal(canDenyAccess(asStep(denying, 'other')), true, 'a policy with a control can deny, whatever its family says')
})

// ---- a step loaded with stale rollout data rolls nothing out ----

test('stale rings, events, dates and wave data on an unavailable step reach no consumer', () => {
  const { r, ctx } = demoRun()
  const live = r.steps.find((s) => s.goalId === 'admin-session' && s.kind !== 'verify')!
  assert.ok(live.events && live.rings.length > 0, 'it is dated to begin with')
  // A step as an older plan file might hand it back: a body, rings, events, and
  // no operations at all.
  const stale = {
    ...live,
    action: { ...live.action, json: '{"displayName":"stale"}', resolution: undefined },
  } as unknown as Step
  assert.equal(unavailableReason(stale), 'no-operation')
  // No schedule map, no wave membership, no row date, no calendar, no finish.
  const rebuilt = runFixture({ ...fixture('demo-week2') })
  assert.ok(!rebuilt.schedule.waves.some((w) => w.stepIds.includes('s-goal-service-accounts-trusted-network')), 'a held policy is in no dated wave')
  assert.equal(rowWhen(stale, '2026-09-08T00:00:00.000Z'), '', 'no row rollout date')
  assert.equal(planFinish([stale]).finish, null, 'no finish contribution')
  assert.ok(!buildIcs([stale], 'Contoso', 'plan-x', (x: Step) => stepExportView(x, ctx)).includes(stale.id), 'no calendar entry')
  // No implementation on any channel, and one next action left.
  assert.equal(implementationOffered(stale), false)
  assert.equal(jsonOffered(stale), false)
  assert.equal(stepPortalLines(stale, { nameOf: (id) => id, policyName: stale.title }), null)
  const view = stepExportView(stale, ctx)
  assert.deepEqual(view.doneWhen, [])
  assert.equal(view.ifWrong, null)
  assert.equal(view.dates, null)
  assert.equal(view.whatToDo.length, 1, view.whatToDo.join(' | '))
})

// ---- a done step with broken operations is not "already in place" ----

test('a done step carrying malformed operations is broken, not preserved', () => {
  const broken = { ...stepWith([{ ...UPDATE, policyId: '' } as unknown as PolicyOperation], '{}'), status: 'done' } as unknown as Step
  assert.equal(isPreserved(broken), false, 'operations that failed validation are not preservation')
  assert.equal(hasMalformedOperations(broken), true)
  const clean = { ...stepWith([], null), status: 'done' } as unknown as Step
  assert.equal(isPreserved(clean), true, 'a goal in place has no operations at all')
  assert.equal(hasMalformedOperations(clean), false)
})

// ---- the baseline conflict is one of the unavailable reasons, everywhere ----

test('a contradictory baseline renders and exports one resolution action and nothing else', () => {
  const { r, ctx } = demoRun()
  const step = r.steps.find((s) => s.goalId === 'admin-portals-protected' && s.kind !== 'verify')!
  assert.equal(unavailableReason(step), 'baseline-conflict')
  assertNothingRollsOut(step, ctx, 'baseline conflict')
  const view = stepExportView(step, ctx)
  assert.equal(view.whatToDo.length, 1, `one next action: ${view.whatToDo.join(' | ')}`)
  assert.match(view.whatToDo[0], /Both cannot be true/)
})


// ---- a create must be a policy Graph would accept ----

test('an incomplete create is not an operation, and one bad member spoils the set', () => {
  const whole = CREATE.body
  const cases: [string, Record<string, unknown>][] = [
    ['no name', { ...whole, displayName: '' }],
    ['no conditions', { displayName: 'A', grantControls: { builtInControls: ['mfa'] } }],
    ['nothing to do about them', { displayName: 'A', conditions: { users: { includeUsers: ['All'] } } }],
    ['empty', {}],
  ]
  for (const [label, body] of cases) {
    const op = { ...CREATE, body } as PolicyOperation
    assert.equal(isValidOperation(op), false, label)
    const step = stepWith([op], '{"displayName":"stale"}')
    assert.equal(unavailableReason(step), 'no-operation', label)
    assert.equal(jsonOffered(step), false, label)
    assert.equal(stepPortalLines(step, { nameOf: (id) => id, policyName: 'x' }), null, label)
    assert.equal(powershellFor(stepOperations(step)).trim(), 'Connect-MgGraph -Scopes Policy.ReadWrite.ConditionalAccess', label)
  }
  // One bad member in an otherwise good set takes the set with it.
  const mixed = stepWith([CREATE, { ...CREATE, body: {} } as PolicyOperation], '{}')
  assert.deepEqual(validOperations(mixed.action), [])
  assert.equal(unavailableReason(mixed), 'no-operation')
  assert.deepEqual(finalTargets(mixed), [])
})

// ---- the impact rules read the operation, never the family ----

test('deny, prompt, strand and batching follow the policy, not the goal it is filed under', () => {
  const asStep = (body: Record<string, unknown>, family: string): Step =>
    ({ ...stepWith([{ sourceName: 'a', mode: 'create', policyId: null, body }], '{}'), kind: 'create', status: 'ready', readiness: { family, percent: 100, lines: [] }, evidence: { status: 'none', lines: [], affectedUserIds: [] }, population: { total: 3, active: 3, admins: 0, guests: 0, ids: ['u1', 'u2', 'u3'], activeIds: ['u1', 'u2', 'u3'], inScope: 3 } }) as unknown as Step
  const users = { users: { includeUsers: ['All'] } }
  const block = asStep({ displayName: 'b', conditions: users, grantControls: { operator: 'OR', builtInControls: ['block'] } }, 'mfa')
  const mfa = asStep({ displayName: 'm', conditions: users, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }, 'block')
  const strength = asStep({ displayName: 's', conditions: users, grantControls: { operator: 'OR', authenticationStrength: { id: 'x', displayName: 'Passkeys' } } }, 'other')
  const device = asStep({ displayName: 'd', conditions: users, grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } }, 'mfa')
  // A block stops people; it asks nobody for anything, whatever its family says.
  assert.equal(canDenyAccess(block), true)
  assert.equal(promptsPeople(block), false, 'a block prompts nobody')
  assert.equal(batchClassOf(block), 'other', 'and interrupts nobody’s sign-in method')
  // A policy that asks for a method prompts, even filed under "block".
  assert.equal(canDenyAccess(mfa), true)
  assert.equal(promptsPeople(mfa), true)
  assert.equal(batchClassOf(mfa), 'mfa')
  // A phishing-resistant strength is a method change too, filed under "other".
  assert.equal(promptsPeople(strength), true)
  assert.equal(batchClassOf(strength), 'mfa')
  // A device requirement is the other kind of interruption, filed under "mfa".
  assert.equal(batchClassOf(device), 'deviceSession')
  // The strand verdict follows the same reading.
  const snapshot = { registrationDetails: [], sources: { registrationDetails: { status: 'ok' } }, users: [], config: {} } as never
  const opts = { breakGlass: false, allowedCountries: [] }
  assert.notEqual(wouldStrand(block, 'u1', snapshot, opts).reason, 'the step cannot deny access', 'a block is read for stranding')
  const quiet = asStep({ displayName: 'q', conditions: users, sessionControls: { persistentBrowser: null } }, 'mfa')
  assert.equal(canDenyAccess(quiet), false, 'a policy that does nothing denies nothing')
  assert.equal(wouldStrand(quiet, 'u1', snapshot, opts).reason, 'the step cannot deny access')
})

// ---- a remapped strength with no name of its own ----

test('a remapped strength with no authoritative name shows neither the author’s name nor its id', () => {
  const AUTHOR = '42de22a7-5339-4a58-b560-28565d53b14d'
  const TENANT = '00000000-9999-4000-8000-000000000043'
  // Confirmed with no name of its own, and no row in the scan to read one from.
  const record = { placeholder: AUTHOR, kind: 'authenticationStrength', group: 'placeholders' as const, resolvedId: TENANT, resolvedName: null, provenance: 'confirmed' as const, doesNotExist: false, validation: null }
  const base = fixture('demo-week2')
  const { r, ctx } = demoRun([], { records: { ...base.mapping.records, [AUTHOR]: record } })
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant' && s.kind !== 'verify')!
  assert.equal(implementationOffered(step), true)
  const strength = ((policyJson(step) as Record<string, Record<string, Record<string, unknown>>>).grantControls).authenticationStrength
  assert.equal(strength.id, TENANT, 'the operation carries the tenant’s id')
  assert.equal(strength.displayName, undefined, 'and no name it cannot vouch for')
  const portal = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)) ?? []
  const grant = portal.find((l) => l.startsWith('Grant → '))
  assert.ok(grant, JSON.stringify(portal))
  assert.ok(!grant.includes('Modern MFA + TAP'), `never the author’s name: ${grant}`)
  assert.ok(!grant.includes(TENANT), `never a raw id: ${grant}`)
  assert.match(grant, /Require authentication strength: Multifactor authentication/, grant)
  assert.ok(policyJsonText(step).includes(TENANT) && powershellFor(stepOperations(step)).includes(TENANT), 'the id is what the request carries')
})

// ---- one classification, and preservation never covers a reason ----

test('done, in place, contradicted and broken are four different answers', () => {
  const done = { ...stepWith([], null), status: 'done' } as unknown as Step
  assert.deepEqual(policyResult(done), { kind: 'preserved' })
  const doneConflicted = { ...stepWith([], null), status: 'done', goalId: 'admin-portals-protected' } as unknown as Step
  assert.deepEqual(policyResult(doneConflicted), { kind: 'unavailable', reason: 'baseline-conflict' }, 'being in place does not settle a contradiction')
  assert.equal(isPreserved(doneConflicted), false)
  const doneMissing = { ...stepWith([], null), status: 'done' } as unknown as Step
  doneMissing.action.missing = [{ token: 'g-1', stepId: 's-prereq-exclusion-group' }]
  assert.deepEqual(policyResult(doneMissing), { kind: 'unavailable', reason: 'missing-object' })
  const doneBroken = { ...stepWith([{ ...UPDATE, policyId: '' } as unknown as PolicyOperation], null), status: 'done' } as unknown as Step
  assert.deepEqual(policyResult(doneBroken), { kind: 'unavailable', reason: 'no-operation' })
  assert.equal(hasMalformedOperations(doneBroken), true)
  const live = stepWith([CREATE], '{}')
  assert.equal(policyResult(live).kind, 'implementable')
  const notAPolicy = { ...stepWith([], null), kind: 'prerequisite' } as unknown as Step
  assert.deepEqual(policyResult(notAPolicy), { kind: 'not-policy' })
})

test('an unavailable policy waiting on low readiness contributes no readiness wait and no finish', () => {
  const held = {
    ...stepWith([], null),
    kind: 'create',
    status: 'blocked',
    readiness: { family: 'mfa', percent: 10, lines: [] },
    blockers: [{ kind: 'readiness', label: 'readiness', binding: 'when MFA readiness reaches 90% (now 10%)' }],
    rings: [{ name: 'r', plannedStart: '2026-10-01T00:00:00.000Z', plannedEnd: '2026-10-08T00:00:00.000Z', targeting: { kind: 'all', groupName: null, memberCount: 1, suggestedMemberIds: [], departments: [] } }],
  } as unknown as Step
  assert.equal(unavailableReason(held), 'no-operation')
  const p = planFinish([held])
  assert.equal(p.finish, null, 'it dates nothing')
  assert.equal(p.waitingCount, 0, 'and it is not waiting on a number that can rise')
})

// ---- the schedule path itself ----

test('a stale unavailable step goes through the schedule and comes out of every structure', () => {
  // A real plan, with one step handed back as an older plan file might hand it:
  // a body, its rings and its dates, and no operations at all.
  const { r } = demoRun()
  const liveStep = r.steps.find((s) => s.goalId === 'admin-session' && s.kind !== 'verify')!
  assert.ok(liveStep.events && liveStep.rings.length > 0, 'it is dated to begin with')
  const stale = { ...liveStep, action: { ...liveStep.action, json: '{"displayName":"a body from an older plan file"}', resolution: undefined } } as unknown as Step
  assert.equal(unavailableReason(stale), 'no-operation')
  const steps = r.steps.map((s) => (s.id === stale.id ? stale : s))
  const schedule = buildSchedule(steps, r.schedule.start, 30)
  // No schedule structure carries it, and the rest of the plan is placed.
  assert.equal(schedule.waveOf[stale.id], undefined, 'no wave')
  assert.ok(!schedule.waves.some((w) => w.stepIds.includes(stale.id)), 'in no wave’s steps')
  assert.equal(schedule.startAt[stale.id], undefined, 'no start')
  assert.equal(schedule.reportOnlyAt[stale.id], undefined, 'no report-only date')
  assert.ok(Object.keys(schedule.startAt).length > 0, 'the rest of the plan is placed')
  // No date, no calendar entry, no finish — whatever it still carries.
  assert.equal(rowWhen(stale, schedule.waves[0]?.start ?? null), '', 'no row date')
  assert.equal(planFinish([stale]).finish, null, 'no finish contribution')
  const ics = buildIcs([stale], 'Contoso', 'plan-x', () => ({ title: 'Stale', why: '', whatToDo: [], doneWhen: [], ifWrong: null, dates: null }))
  assert.ok(!ics.includes(stale.id), 'no calendar entry')
  // And exactly one row, in the undated group.
  const undated = undatedRows(steps, schedule.waves)
  assert.equal(undated.filter((s) => s.id === stale.id).length, 1, 'exactly one undated row for it')
  assert.ok(!schedule.waves.some((w) => w.stepIds.includes(stale.id)), 'and no second row under a wave')
})
