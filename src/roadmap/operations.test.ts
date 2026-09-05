// Foundation A: the step's operations are the authority. A channel that read
// anything else — a body left over in `action.json`, a mode that disagrees with
// its target — could describe a policy the operations do not, so none of them
// does: the JSON, the PowerShell and the download all serialise the operations,
// and an operation that does not say exactly one thing is no operation at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { finalTargets, hasMalformedOperations, isPreserved, isValidOperation, operationsOf, implementationOffered, policyResult, unavailableReason, validOperations } from './operations.ts'
import { policyVerdict, promptsPeople, stepAccountVerdict, wouldStrand } from './strand.ts'
import { batchClassOf, dependencyGraph, observationDaysFor } from './schedule.ts'
import { nobodyAffected, noticeDaysFor } from './timing.ts'
import { effectOf, isCompletePolicy, isSubmittablePatch, stepEffects, strengthLookupOf } from './operations.ts'
import { lockoutCount } from './lockout.ts'
import type { PolicyEffect } from './operations.ts'
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
const CREATE: PolicyOperation = { sourceName: 'author', mode: 'create', policyId: null, body: { displayName: 'A', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
const UPDATE: PolicyOperation = { sourceName: 'author', mode: 'update', policyId: 'p-1', body: { state: 'enabled' }, target: { id: 'p-1', displayName: 'the tenant’s own', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }

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
  const a: PolicyOperation = { sourceName: 'A', mode: 'create', policyId: null, body: { displayName: 'A', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
  const b: PolicyOperation = { sourceName: 'B', mode: 'update', policyId: 'p-b', body: { state: 'enabled' }, target: { id: 'p-b', displayName: 'B', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
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
  assert.equal(strength.displayName, undefined, 'and nothing that describes it: the request carries a reference')
  assert.deepEqual(Object.keys(strength), ['id'])
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
  // The target is the whole policy the change leaves behind, not a stub.
  const whole = { id: 'p-1', displayName: 'x', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
  const base: PolicyOperation = { sourceName: 'a', mode: 'update', policyId: 'p-1', body: { state: 'enabled' }, target: whole }
  assert.equal(isValidOperation(base), true)
  const noTarget = { ...base, target: undefined } as PolicyOperation
  const emptyTarget = { ...base, target: {} } as PolicyOperation
  const idAndState = { ...base, target: { id: 'p-1', state: 'enabled' } } as PolicyOperation
  const idNameState = { ...base, target: { id: 'p-1', displayName: 'x', state: 'enabled' } } as PolicyOperation
  const contradicted = { ...base, target: { ...whole, state: 'enabledForReportingButNotEnforced' } } as PolicyOperation
  const wrongIdentity = { ...base, target: { ...whole, id: 'p-another' } } as PolicyOperation
  const noIdentity = { ...base, target: { ...whole, id: undefined } } as PolicyOperation
  for (const [label, op] of [
    ['no target', noTarget],
    ['empty target', emptyTarget],
    ['a target of an id and a state', idAndState],
    ['a target of an id, a name and a state', idNameState],
    ['target disagrees', contradicted],
    ['target names another policy', wrongIdentity],
    ['target names no policy', noIdentity],
  ] as [string, PolicyOperation][]) {
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
  const quiet: PolicyOperation = { sourceName: 'a', mode: 'create', policyId: null, body: { displayName: 'a', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, sessionControls: { persistentBrowser: null } } }
  const denying: PolicyOperation = { sourceName: 'a', mode: 'create', policyId: null, body: { displayName: 'a', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } } }
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
    ['no state', { ...whole, state: undefined }],
    ['a state Conditional Access has no idea about', { ...whole, state: 'paused' }],
    ['no conditions', { displayName: 'A', state: 'enabled', grantControls: { builtInControls: ['mfa'] } }],
    ['conditions that scope nobody', { ...whole, conditions: { users: {}, applications: {} } }],
    ['a control that is not a name at all', { ...whole, grantControls: { operator: 'OR', builtInControls: ['   '] } }],
    ['a control Conditional Access has never heard of', { ...whole, grantControls: { operator: 'OR', builtInControls: ['makeThemThinkAboutIt'] } }],
    ["Graph's own read-only fields", { ...whole, id: 'p-1', createdDateTime: '2026-01-01T00:00:00Z' }],
    ['a session control that does nothing', { ...whole, grantControls: null, sessionControls: { persistentBrowser: null } }],
    ['nothing to do about them', { displayName: 'A', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } } }],
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
  const users = { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }
  const block = asStep({ displayName: 'b', state: 'enabled', conditions: users, grantControls: { operator: 'OR', builtInControls: ['block'] } }, 'mfa')
  const mfa = asStep({ displayName: 'm', state: 'enabled', conditions: users, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }, 'block')
  const strength = asStep({ displayName: 's', state: 'enabled', conditions: users, grantControls: { operator: 'OR', authenticationStrength: { id: 'x' } } }, 'other')
  const device = asStep({ displayName: 'd', state: 'enabled', conditions: users, grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } }, 'mfa')
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
  const quiet = asStep({ displayName: 'q', state: 'enabled', conditions: users, sessionControls: { persistentBrowser: null } }, 'mfa')
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
  // Nor what the author's object allowed: those describe a different object, and
  // a policy read through them would be judged by what it does not require.
  assert.equal(strength.allowedCombinations, undefined, 'and none of the author’s combinations')
  assert.deepEqual(stepEffects(step)[0].strength, { id: TENANT }, 'the request carries a reference and nothing else')
  assert.equal(step.lockout, undefined, 'and it counts nobody out')
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


// ---- what a policy does, read from the policy ----

const SCOPE = { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] } }
/** A complete policy, with whatever this case is about laid over it. */
const policy = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  displayName: 'p',
  state: 'enabledForReportingButNotEnforced',
  conditions: SCOPE,
  grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  ...over,
})

test('a complete policy is a name, a state, a scope and a real control', () => {
  assert.equal(isCompletePolicy(policy()), true)
  assert.equal(isCompletePolicy(policy({ sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours' } }, grantControls: null })), true, 'a session-only policy is a policy')
  assert.equal(isCompletePolicy(policy({ state: 'paused' })), false, 'not a state Conditional Access has')
  assert.equal(isCompletePolicy(policy({ conditions: { users: {}, applications: {} } })), false, 'conditions that scope nobody')
  assert.equal(isCompletePolicy(policy({ conditions: { users: { includeUsers: ['All'] } } })), false, 'people but no resources')
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'OR', builtInControls: ['soundTheAlarm'] } })), false, 'a control Conditional Access does not have')
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'OR', builtInControls: ['riskRemediation'] } })), true, 'one it does have, and IAMAI has no reading for')
  assert.equal(effectOf(policy({ grantControls: { operator: 'OR', builtInControls: ['riskRemediation'] } })).unknown.length, 1, 'carried, marked unreadable')
  assert.equal(isCompletePolicy(policy({ grantControls: null, sessionControls: { persistentBrowser: null } })), false, 'a session control that does nothing')
  assert.equal(isCompletePolicy(policy({ grantControls: null, sessionControls: { signInFrequency: { isEnabled: false } } })), false, 'a session control switched off')
  assert.equal(isCompletePolicy({}), false)
})

test('the effect is read from the policy: block, method, device, place, risk, session', () => {
  const block = effectOf(policy({ grantControls: { operator: 'OR', builtInControls: ['block'] } }))
  assert.equal(block.blocks, true)
  assert.equal(block.asksForMethod, false)
  const strength = effectOf(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: 's-1' } } }))
  assert.equal(strength.asksForMethod, true)
  assert.deepEqual(strength.requirements, [{ kind: 'strength', id: 's-1' }], 'the strength is a requirement of its own, not a family')
  const device = effectOf(policy({ grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } }))
  assert.equal(device.requiresDevice, true)
  assert.deepEqual(device.requirements, [{ kind: 'device', control: 'compliantdevice' }])
  const several = effectOf(policy({ grantControls: { operator: 'AND', builtInControls: ['mfa', 'compliantDevice', 'approvedApplication'] } }))
  assert.equal(several.operator, 'AND')
  assert.deepEqual(
    several.requirements.map((r) => r.kind),
    ['mfa', 'device', 'app'],
    'a device, an app and a method stay three separate requirements',
  )
  const place = effectOf(policy({ conditions: { ...SCOPE, locations: { includeLocations: ['All'], excludeLocations: ['loc-1'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }))
  assert.equal(place.usesLocations, true)
  const risky = effectOf(policy({ conditions: { ...SCOPE, signInRiskLevels: ['high'] } }))
  assert.equal(risky.usesRisk, true)
  const session = effectOf(policy({ grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours' } } }))
  assert.equal(session.session, true)
  assert.equal(session.any, true)
})

// ---- the account verdict, the dependencies and the timing follow the policy ----

test('the strand verdict, the dependencies, the notice and the observation all follow the policy, not the family', () => {
  const snapshot = {
    registrationDetails: [{ id: 'u1', isMfaCapable: false, methodsRegistered: [] }],
    sources: { registrationDetails: { status: 'ok' }, devices: { status: 'ok' } },
    devices: [],
    users: [{ id: 'u1', usageLocation: 'NZ', userType: 'member' }],
    config: { authStrengths: { status: 'ok', reason: null, rows: [{ id: 's', displayName: 'Keys only', allowedCombinations: ['fido2'] }] } },
    evidenceUsage: { legacyAuth: { userIds: ['u1'] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] } },
  } as never
  const asStep = (body: Record<string, unknown>, family: string, id = 's-x'): Step =>
    ({
      ...stepWith([{ sourceName: 'a', mode: 'create', policyId: null, body }], '{}'),
      id,
      kind: 'create',
      phase: 1,
      status: 'ready',
      readiness: { family, percent: 100, lines: [] },
      evidence: { status: 'ok', lines: [], affectedUserIds: ['u1'] },
      population: { total: 1, active: 1, admins: 0, guests: 0, ids: ['u1'], activeIds: ['u1'], inScope: 1 },
      blockedBy: [],
    }) as unknown as Step
  const opts = { breakGlass: false, allowedCountries: ['AU'], countryLocations: { 'loc-au': ['AU'] } }
  // A block filed under mfa: the account is stranded because it was seen using
  // what the policy blocks, not because it has no method.
  const block = asStep(policy({ grantControls: { operator: 'OR', builtInControls: ['block'] } }), 'mfa', 's-block')
  assert.match(wouldStrand(block, 'u1', snapshot, opts).reason, /seen using what the step blocks/)
  // MFA filed under block: the account is stranded for having no method.
  const mfa = asStep(policy(), 'block', 's-mfa')
  assert.match(wouldStrand(mfa, 'u1', snapshot, opts).reason, /no MFA method/)
  // A phishing-resistant strength filed under other.
  const strength = asStep(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: 's' } } }), 'other', 's-strength')
  assert.match(wouldStrand(strength, 'u1', snapshot, opts).reason, /no method this strength allows/)
  // A device requirement filed under mfa.
  const device = asStep(policy({ grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } }), 'mfa', 's-device')
  assert.match(wouldStrand(device, 'u1', snapshot, opts).reason, /no compliant device/)
  // A place filed under mfa: the account signs in from a country the policy blocks.
  const place = asStep(policy({ conditions: { ...SCOPE, locations: { includeLocations: ['All'], excludeLocations: ['loc-au'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }), 'mfa', 's-place')
  assert.equal(wouldStrand(place, 'u1', snapshot, opts).stranded, true)
  // A strength nothing describes: unknown, never a guess from the family.
  const unreadable = asStep(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: 's-this-tenant-has-no-such-thing' } } }), 'mfa', 's-unreadable')
  const verdict = wouldStrand(unreadable, 'u1', snapshot, opts)
  assert.equal(verdict.unknown, true)
  assert.equal(verdict.stranded, false)

  // The same reading drives the batching, the notice and the observation window.
  assert.equal(batchClassOf(block), 'other')
  assert.equal(batchClassOf(mfa), 'mfa')
  assert.equal(batchClassOf(strength), 'mfa')
  assert.equal(batchClassOf(device), 'deviceSession')
  // A block nobody was seen using affects nobody; one they were seen using does.
  const quietBlock = { ...block, evidence: { status: 'ok', lines: [], affectedUserIds: [] } } as unknown as Step
  assert.equal(nobodyAffected(quietBlock), true, 'a block nobody used')
  assert.equal(nobodyAffected(block), false)
  assert.equal(noticeDaysFor(quietBlock) < noticeDaysFor(block), true, 'a change nobody feels needs less notice')
  assert.equal(observationDaysFor(quietBlock) < observationDaysFor(block), true, 'and a shorter watch')
  // A policy that asks for a method is measured by who it applies to, whatever
  // evidence says, so it is never "nobody".
  assert.equal(nobodyAffected({ ...mfa, evidence: { status: 'ok', lines: [], affectedUserIds: [] } } as unknown as Step), false)

  // The dependency graph reads the same policies.
  const bg = { ...asStep(policy(), 'other', 's-prereq-break-glass'), kind: 'prerequisite' } as unknown as Step
  const verify = { ...asStep(policy(), 'other', 's-verify-mfa'), kind: 'verify' } as unknown as Step
  const loc = { ...asStep(policy(), 'other', 's-prereq-trusted-location'), kind: 'prerequisite' } as unknown as Step
  const graph = dependencyGraph([bg, verify, loc, block, mfa, place])
  const deps = (id: string): { stepId: string; reason: string }[] => (graph[id] ?? []) as { stepId: string; reason: string }[]
  assert.ok(deps(block.id).some((d) => d.stepId === bg.id && d.reason === 'break-glass'), 'a block waits for the way back in')
  assert.ok(!deps(mfa.id).some((d) => d.reason === 'break-glass'), 'a method change does not')
  assert.ok(deps(mfa.id).some((d) => d.stepId === verify.id && d.reason === 'registration'), 'a method change waits for people to register')
  assert.ok(!deps(block.id).some((d) => d.reason === 'registration'), 'a block does not')
  assert.ok(deps(place.id).some((d) => d.stepId === loc.id && d.reason === 'named-location'), 'a policy naming a place waits for the place')
})

test('a step with several policies is stranded by any of them, and an unavailable one strands nobody', () => {
  const snapshot = {
    registrationDetails: [{ id: 'u1', isMfaCapable: true, methodsRegistered: ['microsoftAuthenticatorPush'] }],
    sources: { registrationDetails: { status: 'ok' }, devices: { status: 'ok' } },
    devices: [],
    users: [{ id: 'u1', userType: 'member' }],
    config: { authStrengths: { status: 'ok', reason: null, rows: [{ id: 's', displayName: 'Keys only', allowedCombinations: ['fido2'] }] } },
    evidenceUsage: { legacyAuth: { userIds: [] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] } },
  } as never
  const withOps = (ops: PolicyOperation[]): Step =>
    ({
      ...stepWith(ops, '{}'),
      kind: 'create',
      status: 'ready',
      readiness: { family: 'other', percent: 100, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [] },
      population: { total: 1, active: 1, admins: 0, guests: 0, ids: ['u1'], activeIds: ['u1'], inScope: 1 },
    }) as unknown as Step
  const op = (body: Record<string, unknown>, name: string): PolicyOperation => ({ sourceName: name, mode: 'create', policyId: null, body })
  const canMfa = op(policy(), 'A')
  const needsPasskey = op(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: 's' } } }), 'B')
  const both = withOps([canMfa, needsPasskey])
  assert.equal(stepEffects(both).length, 2, 'both policies are read')
  const verdict = stepAccountVerdict(both, 'u1', snapshot, {})
  assert.equal(verdict.stranded, true, 'the account clears one policy and not the other')
  assert.match(verdict.reason, /no method this strength allows/)
  // One of the two invalid: the step can run nothing, so it strands nobody.
  const broken = withOps([canMfa, { ...needsPasskey, body: {} } as PolicyOperation])
  assert.equal(unavailableReason(broken), 'no-operation')
  assert.deepEqual(stepEffects(broken), [])
  assert.equal(canDenyAccess(broken), false)
  assert.equal(stepAccountVerdict(broken, 'u1', snapshot, {}).stranded, false)
  assert.equal(batchClassOf(broken), 'other')
})

// ---- what IAMAI submits, and what it merely reads ----

test('a create is offered only for the shapes IAMAI writes, and an unknown one is never quietly dropped', () => {
  // Every field here is one IAMAI itself emits.
  assert.equal(isCompletePolicy(policy({ description: 'why', sessionControls: { signInFrequency: { isEnabled: true, value: 1, type: 'hours' } } })), true)
  assert.equal(isCompletePolicy(policy({ conditions: { ...SCOPE, clientAppTypes: ['all'], platforms: { includePlatforms: ['all'] }, authenticationFlows: { transferMethods: 'deviceCodeFlow' } } })), true)
  assert.equal(
    isCompletePolicy({
      displayName: 'workload',
      state: 'enabled',
      conditions: { clientApplications: { includeServicePrincipals: ['All'] }, locations: { includeLocations: ['All'], excludeLocations: ['loc-1'] } },
      grantControls: { operator: 'OR', builtInControls: ['block'] },
    }),
    true,
    'a workload-identity policy scopes its people and its resources through clientApplications',
  )
  // A control IAMAI has no reading for is carried exactly as the baseline holds
  // it — dropping it would submit a policy that means something else — and it is
  // never counted as one IAMAI does know.
  const unknownControl = policy({ grantControls: { operator: 'OR', builtInControls: ['mfa', 'riskRemediation'] } })
  assert.equal(isCompletePolicy(unknownControl), true, 'the request is one Graph would take')
  const carried = effectOf(unknownControl)
  assert.deepEqual(carried.unknown, ['a grant control IAMAI has no reading for: riskremediation'])
  assert.equal(carried.controls.has('riskremediation'), false)
  assert.deepEqual(
    carried.requirements.map((r) => r.kind),
    ['mfa', 'other'],
    'kept as a requirement of its own, not folded into the one beside it',
  )
  assert.equal(carried.any, true, 'a policy that requires something IAMAI cannot read still requires something')
  // The same for a condition and a session control it has no reading for.
  assert.equal(effectOf(policy({ conditions: { ...SCOPE, insiderThreat: { level: 'high' } } })).unknown.length, 1)
  assert.equal(effectOf(policy({ sessionControls: { unheardOf: { isEnabled: true } } })).unknown.length, 1)
  // Graph's own annotations travel back with a policy and mean nothing on the way in.
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'OR', builtInControls: ['mfa'], 'authenticationStrength@odata.context': 'https://graph.microsoft.com/x' } })), true)
  assert.deepEqual(effectOf(policy({ grantControls: { operator: 'OR', builtInControls: ['mfa'], 'authenticationStrength@odata.context': 'x' } })).unknown, [])
  // What is refused is a request Graph would refuse.
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'MAYBE', builtInControls: ['mfa'] } })), false, 'an operator that is neither AND nor OR')
  assert.equal(isCompletePolicy(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: '  ' } } })), false, 'a strength with no id')
  assert.equal(isCompletePolicy(policy({ id: 'p-1', createdDateTime: '2026-01-01T00:00:00Z' })), false, "Graph's own read-only fields are not a create's to send")
  assert.equal(isCompletePolicy(policy({ notAField: 1 })), false)
})

test('an update validates what it submits, and reads the tenant policy it does not', () => {
  const target = {
    id: 'p-1',
    displayName: 'the tenant one',
    state: 'enabled',
    description: 'kept',
    // Properties IAMAI never writes, on the tenant's own policy.
    templateId: 'abc',
    modifiedDateTime: '2026-01-01T00:00:00Z',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, insiderRiskLevels: 'elevated' },
    grantControls: { operator: 'OR', builtInControls: ['mfa'], termsOfUse: ['t-1'] },
  }
  const op = { sourceName: 'a', mode: 'update', policyId: 'p-1', body: { state: 'enabled' }, target } as unknown as PolicyOperation
  assert.equal(isValidOperation(op), true, 'the tenant may carry anything; only the submitted state is checked')
  assert.equal(isSubmittablePatch({ state: 'enabled' }), true)
  assert.equal(isSubmittablePatch({ state: 'paused' }), false)
  assert.equal(isSubmittablePatch({ grantControls: { operator: 'OR', builtInControls: ['riskRemediation'] } }), true, 'a control IAMAI has no reading for is still the tenant policy submitting it')
  assert.equal(isSubmittablePatch({ id: 'p-1' }), false, "Graph's own read-only fields are not an update's to send")
  assert.equal(isSubmittablePatch({}), false)
  // The target must still be the policy the request is submitted to, and agree
  // with what the body submits.
  assert.equal(isValidOperation({ ...op, target: { ...target, id: 'p-2' } } as PolicyOperation), false)
  assert.equal(isValidOperation({ ...op, body: { state: 'disabled' } } as PolicyOperation), false)
  // And what the tenant's policy carries is read, not guessed: terms of use IAMAI
  // cannot judge make the effect unreadable rather than something invented.
  assert.deepEqual(effectOf(target).unknown, ['terms of use', 'a condition IAMAI has no reading for: insiderRiskLevels'])
})

// ---- the verdict follows every requirement, combined the way the policy combines them ----

const FIDO_ONLY = 'a1000000-0000-4000-8000-00000000f1d0'
const SCAN = {
  registrationDetails: [{ id: 'u1', isMfaCapable: true, methodsRegistered: ['microsoftAuthenticatorPush'] }],
  config: { authStrengths: { status: 'ok', reason: null, rows: [{ id: FIDO_ONLY, displayName: 'Security key only', allowedCombinations: ['fido2'] }] } },
  sources: { registrationDetails: { status: 'ok' }, devices: { status: 'ok' } },
  devices: [],
  users: [{ id: 'u1', usageLocation: 'NZ' }],
  evidenceUsage: { legacyAuth: { userIds: [] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] } },
} as never

test('every requirement is judged on its own, and AND and OR are not the same policy', () => {
  const grant = (over: Record<string, unknown>): Record<string, unknown> => policy({ grantControls: { operator: 'OR', ...over } })
  // The account can approve a sign-in but owns no compliant device.
  const or = effectOf(grant({ operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] }))
  assert.equal(policyVerdict(or, 'u1', SCAN, {}).stranded, false, 'either will do, and one of them can be done')
  const and = effectOf(grant({ operator: 'AND', builtInControls: ['mfa', 'compliantDevice'] }))
  const both = policyVerdict(and, 'u1', SCAN, {})
  assert.equal(both.stranded, true, 'both are needed, and one of them cannot be done')
  assert.match(both.reason, /no compliant device/, 'and the device is named, not the method')
  // An app requirement is not a device requirement, and the scan cannot settle it.
  const app = policyVerdict(effectOf(grant({ builtInControls: ['approvedApplication'] })), 'u1', SCAN, {})
  assert.equal(app.unknown, true)
  assert.equal(app.stranded, false)
  // A strength nothing describes is unknown, never a guess.
  const blind = policyVerdict(effectOf(grant({ authenticationStrength: { id: 's-9' } })), 'u1', SCAN, {})
  assert.equal(blind.unknown, true, 'this tenant does not describe it')
  assert.equal(blind.stranded, false)
  // Under OR, an alternative nobody can read withdraws a stranded verdict: it
  // may be the way through.
  const mixed = policyVerdict(effectOf(grant({ operator: 'OR', builtInControls: ['compliantDevice'], authenticationStrength: { id: 's-9' } })), 'u1', SCAN, {})
  assert.equal(mixed.stranded, false)
  assert.equal(mixed.unknown, true)
  // Under AND it does not: the device is needed whatever the strength turns out to be.
  const andBlind = policyVerdict(effectOf(grant({ operator: 'AND', builtInControls: ['compliantDevice'], authenticationStrength: { id: 's-9' } })), 'u1', SCAN, {})
  assert.equal(andBlind.stranded, true)
  // A password change is something anyone can do.
  assert.equal(policyVerdict(effectOf(grant({ builtInControls: ['passwordChange'] })), 'u1', SCAN, {}).stranded, false)
  // A phishing-resistant strength the tenant does describe: the account has push only.
  const strong = policyVerdict(effectOf(grant({ authenticationStrength: { id: FIDO_ONLY } })), 'u1', SCAN, {})
  assert.equal(strong.stranded, true)
  assert.match(strong.reason, /no method this strength allows/)
})

test('a policy IAMAI cannot read in full never reads as safe', () => {
  for (const grant of [
    { operator: 'OR', builtInControls: ['mfa'], termsOfUse: ['t-1'] },
    { operator: 'OR', builtInControls: ['mfa', 'riskRemediation'] },
  ]) {
    const v = policyVerdict(effectOf({ ...policy(), grantControls: grant }), 'u1', SCAN, {})
    assert.equal(v.unknown, true, 'the account can approve a sign-in, but the policy asks for something else as well')
    assert.equal(v.stranded, false)
  }
})

// ---- the consequences are conservative ----

test('zero impact is proved one person at a time, and an unreadable policy is never zero', () => {
  const step = (body: Record<string, unknown>, over: Record<string, unknown> = {}): Step =>
    ({
      ...stepWith([{ sourceName: 'a', mode: 'create', policyId: null, body }], '{}'),
      kind: 'create',
      status: 'ready',
      readiness: { family: 'other', percent: 100, lines: [] },
      evidence: { status: 'ok', lines: [], affectedUserIds: [] },
      population: { total: 1, active: 1, admins: 0, guests: 0, ids: ['u1'], activeIds: ['u1'], inScope: 1 },
      ...over,
    }) as unknown as Step
  const block = policy({ grantControls: { operator: 'OR', builtInControls: ['block'] } })
  assert.equal(nobodyAffected(step(block)), true, 'a block nobody was seen using')
  assert.equal(nobodyAffected(step(block, { evidence: { status: 'ok', lines: [], affectedUserIds: ['u1'] } })), false)
  assert.equal(nobodyAffected(step(block, { evidence: { status: 'partial', lines: [], affectedUserIds: [] } })), false, 'records that could not be read are not proof of zero')
  assert.equal(nobodyAffected(step(policy())), false, 'a policy that asks people for something touches everyone it applies to')
  assert.equal(nobodyAffected(step(policy(), { population: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [], inScope: 0 } })), true, 'unless it applies to nobody')
  const unreadable = { ...policy(), grantControls: { operator: 'OR', builtInControls: ['block'], termsOfUse: ['t-1'] } }
  assert.equal(nobodyAffected(step(unreadable)), false, 'a policy IAMAI cannot read in full is never zero')
  // A session-only policy is felt, so it batches with the device work.
  const sessionOnly = step(policy({ grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours' } } }))
  assert.equal(batchClassOf(sessionOnly), 'deviceSession')
  assert.equal(nobodyAffected(sessionOnly), false, 'a shorter session is felt by everyone it applies to')
})

test('the lockout count comes from the strength the step will leave behind, not the goal it is filed under', () => {
  const viability = [
    { userId: 'u1', activity: 'active', mfaCapable: true, registered: ['microsoftAuthenticatorPush'], kinds: [], methodTiers: ['push'], evidence: { at: '2026-01-01', method: 'push' } },
    { userId: 'u2', activity: 'active', mfaCapable: true, registered: ['passKeyDeviceBound'], kinds: ['passKeyDeviceBound'], methodTiers: ['phishingResistant'], evidence: { at: '2026-01-01', method: 'passKeyDeviceBound' } },
    { userId: 'u3', activity: 'dormant', mfaCapable: false, registered: [], kinds: [], methodTiers: [] },
  ] as never[]
  const snapshot = {
    registrationDetails: [
      { id: 'u1', isMfaCapable: true, methodsRegistered: ['microsoftAuthenticatorPush'] },
      { id: 'u2', isMfaCapable: true, methodsRegistered: ['passKeyDeviceBound'] },
      { id: 'u3', isMfaCapable: false, methodsRegistered: [] },
    ],
    sources: { registrationDetails: { status: 'ok' }, devices: { status: 'ok' } },
    devices: [],
    users: [],
    roles: { active: {}, eligible: {} },
    config: { authStrengths: { status: 'ok', reason: null, rows: [{ id: FIDO_ONLY, displayName: 'Security key only', allowedCombinations: ['fido2'] }] } },
    evidenceUsage: { legacyAuth: { userIds: [] }, deviceCode: { userIds: [] }, authTransfer: { userIds: [] } },
  } as never
  const strengths = strengthLookupOf(snapshot)
  const scope = ['u1', 'u2', 'u3']
  const count = (effects: PolicyEffect[], ids: string[] = scope): number | null => lockoutCount(effects, ids, viability, snapshot, strengths)
  const strong = effectOf(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: FIDO_ONLY } } }))
  assert.equal(count([strong]), 1, 'the active person with push only; the dormant one is not counted')
  assert.equal(count([strong], ['u2']), 0, 'the scope is the policy’s own')
  const plain = effectOf(policy({ grantControls: { operator: 'OR', builtInControls: ['mfa'] } }))
  assert.equal(count([plain]), null, 'a policy that requires no strength has no lockout list')
  const blind = effectOf(policy({ grantControls: { operator: 'OR', authenticationStrength: { id: 's-9' } } }))
  assert.equal(count([blind]), null, 'and neither has one nobody can read')
  assert.equal(count([]), null, 'nor work the plan cannot write')
})
