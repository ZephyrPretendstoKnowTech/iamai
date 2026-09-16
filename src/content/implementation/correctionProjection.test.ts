// Partial, generically (correction batch 1): a mapped policy whose material
// fields differ from the plan is corrected by the modules those fields select,
// in every policy package that authors a correction — not only the pilot's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING, mismatchBindingOf } from './protocol.ts'
import { UNRESOLVED, present, projectImplementation, projectSafely } from './project.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { referenceOptions } from '../../roadmap/answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from '../../roadmap/sourceMappings.ts'
import { nextSafeAction } from '../../roadmap/nextSafeAction.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { artifactText, correctionFieldsOf, implementationPackageFor, packageBindings, packageRuntime, packageStateOf, plannedOperationsOf, plannedPackageStateOf, planningPreview } from '../../ui/surfaces/stepPackage.ts'
import { CONTRACT } from '../../ui/surfaces/stepContract.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

function plan(name: FixtureName) {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { f, r, ctx }
}

test('every policy package that authors a correction registers it, and every module it keeps is one IAMAI can select', () => {
  const partials = Object.values(PACKAGES).filter((p) => p.meta.projection.partial)
  assert.ok(partials.length >= 21, `only ${partials.length} Partial projections are registered`)
  for (const p of partials) {
    const table = (p.meta.projection.partial as { mismatches: Record<string, { facts?: unknown; select?: unknown }> }).mismatches
    for (const [id, m] of Object.entries(table)) assert.ok(m.facts !== undefined || m.select !== undefined, `${p.meta.stepId}: ${id} cannot be selected`)
  }
})

test('the workload identity Partial names its one mismatch binding and composes the policy corrections its facts select', () => {
  const pkg = PACKAGES['s-goal-workload-identity-block']
  const partial = pkg.meta.projection.partial as Record<string, unknown> | undefined
  assert.ok(partial, 'the Partial projection was withheld at compile time')
  assert.equal(mismatchBindingOf(partial), 'policy.current.semanticMismatches')
  const bindings = {
    'policy.current.id': 'policy-1',
    'policy.current.state': 'enabledForReportingButNotEnforced',
    [CHANGED_FIELDS_BINDING]: ['conditions.locations'],
    'workload.cloudSync.servicePrincipalId': 'sp-1',
    'location.syncServer.id': 'location-1',
    'location.syncServer.ipRanges': ['203.0.113.10/32'],
    'location.syncServer.displayName': 'Sync server',
    'policy.target.displayName': 'Workload block',
    'tenant.displayName': 'Tenant',
  }
  const prerequisites = ((pkg.meta as { prerequisites?: { id: string }[] }).prerequisites ?? []).map((p) => p.id)
  const p = projectSafely(pkg, 'partial', bindings, { satisfied: new Set(prerequisites), baselineCommit: null })
  assert.deepEqual(p.hold?.invalid ?? [], [], JSON.stringify(p.hold))
  assert.deepEqual(p.hold?.unknownMismatches ?? [], [])
  const blocks = p.channels.flatMap((c) => c.blocks)
  assert.ok(blocks.includes('entra.correct.policy.location-boundary'), `the selected correction is not composed: ${JSON.stringify(p.hold)} ${blocks.join(', ')}`)
  assert.equal(blocks.some((b) => /location\.ip-ranges|json\.correct\.location$/.test(b)), false, 'a named-location correction no fact selects was composed')
})

test('an enforced policy whose exclusions differ from the plan plans the conditions correction, and only that', () => {
  const { f, r, ctx } = plan('demo')
  const step = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  const c = stepContract(step, ctx)
  assert.deepEqual(correctionFieldsOf(step, f.snapshot), ['conditions.users.excludeGroups'])
  assert.equal(plannedPackageStateOf(step, c, f.snapshot), 'partial')
  const pkg = implementationPackageFor(step)!
  const state = packageStateOf(step, c, f.snapshot)!
  const bindings = packageBindings(step, ctx, c)
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  const projection = projectSafely(pkg, state, bindings, runtime)
  const preview = planningPreview(pkg, step, c, f.snapshot, bindings, runtime, projection) ?? projection
  assert.ok(preview.channels.length > 0, 'the correction has no copyable guidance')
  assert.equal(preview.state, 'partial')
  assert.deepEqual(preview.channels.find((x) => x.channel === 'json')?.blocks, ['json.correct-conditions'], 'a correction the changed fields do not ask for was composed')
  assert.equal(preview.channels.some((x) => x.blocks.some((b) => /grant|session|name/.test(b))), false)
})

test('a real enforced policy missing its exclusions projects an executable correction of those conditions only, while emergency access remains a readiness prerequisite', () => {
  // The demo tenant's own legacy-authentication block, enforced without the
  // canonical exclusions, with the baseline's unsettled source references answered
  // so the users the correction writes are settled.
  const base = fixture('demo')
  const source = BASELINE_MAPPINGS_KEY
  const pending = sourceMappingsOf(runFixture(base).steps)
  const f = { ...base, mapping: applyStepDecisions(base.mapping, { [source]: { answers: Object.fromEntries(pending.map((p) => [p.id, referenceOptions()[0]])), at: base.snapshot.asOf } }) }
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const step = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  const c = stepContract(step, ctx)
  assert.deepEqual(correctionFieldsOf(step, f.snapshot), ['conditions.users.excludeGroups'], 'the premise: only the exclusions differ')
  const pkg = implementationPackageFor(step)!
  const bindings = packageBindings(step, ctx, c)
  const op = plannedOperationsOf(step)[0]
  assert.equal(op.mode, 'update')
  // Every value the correction needs resolves from the tenant and the plan.
  for (const key of ['policy.current.id', 'policy.target.conditions', CHANGED_FIELDS_BINDING]) assert.ok(present(bindings[key]), `${key} does not resolve`)
  const { runtime } = packageRuntime(pkg, 'partial', bindings, {})
  const executable = projectImplementation(pkg, 'partial', bindings, runtime)
  assert.equal(executable.hold, null, JSON.stringify(executable.hold))
  assert.equal(executable.preview, undefined, 'the correction is a planning preview, not an artifact')
  assert.deepEqual(executable.degraded ?? [], [])
  const json = executable.channels.find((x) => x.channel === 'json')!
  // The JSON channel is a request or nothing (S6): the PATCH the package declares,
  // bound to the tenant's own policy by id, never a request IAMAI invented.
  assert.deepEqual(json.requests, [{ method: 'PATCH', endpoint: `https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${op.policyId}` }], 'the request the package declares, sent to the policy it corrects')
  assert.equal(bindings['policy.current.id'], op.policyId, 'the correction does not name the tenant’s own policy')
  const body = JSON.parse(json.text) as Record<string, unknown>
  assert.deepEqual(Object.keys(body), ['conditions'], 'a field no change asks for was submitted')
  assert.deepEqual((body.conditions as { users: { excludeGroups: string[] } }).users.excludeGroups, (op.target as { conditions: { users: { excludeGroups: string[] } } }).conditions.users.excludeGroups)
  assert.equal(executable.channels.some((x) => x.blocks.some((b) => /grant|session|report-only|lifecycle|name/.test(b))), false, 'an unrelated correction was composed')
  for (const ch of executable.channels) assert.equal(UNRESOLVED.test(ch.text), false, `${ch.channel} carries a placeholder`)
  // The Plan hands it over only when its next safe action can be executed: the
  // emergency-access prerequisite owns putting the exclusions back first.
  const next = nextSafeAction(step)
  assert.deepEqual([next.kind, next.executable], ['correct', false])
  assert.ok(step.blockedBy.includes('s-prereq-break-glass'), JSON.stringify(step.blockedBy))
  // The prerequisite still governs readiness; the resolved correction stays available to copy.
  assert.equal(step.blockers.some((b) => b.kind === 'step' && b.stepId === 's-prereq-break-glass'), true, 'the premise: the step waits on emergency access')
  assert.equal(packageStateOf(step, c, f.snapshot), 'partial', 'readiness does not hide a relevant resolved correction')
  assert.equal(plannedPackageStateOf(step, c, f.snapshot), 'partial', 'the held correction is still planned')
})

test('an omitted source exception preserves the tenant’s existing excluded person instead of creating a removal correction', () => {
  // Week two, the baseline's unsettled source references answered: emergency access
  // is in place and the legacy-authentication block is enforced and correct. Then
  // someone excludes one ordinary person from it by hand.
  const raw = fixture('demo-week2')
  const source = BASELINE_MAPPINGS_KEY
  const pending = sourceMappingsOf(runFixture(raw).steps)
  const base = { ...raw, mapping: applyStepDecisions(raw.mapping, { [source]: { answers: Object.fromEntries(pending.map((p) => [p.id, referenceOptions()[0]])), at: raw.snapshot.asOf } }) }
  const before = runFixture(base).steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  assert.equal(before.state.satisfied, true, 'the premise: the policy is in place before the change')
  const person = (base.snapshot.users ?? []).find((u) => !JSON.stringify(base.mapping).includes(String(u.id)) && u.accountEnabled !== false)!.id
  const f = structuredClone(base)
  const row = (f.snapshot.config!.caPolicies!.rows as Record<string, unknown>[]).find((x) => x.id === before.tracking!.policyId)!
  const tenantUsers = (row.conditions as { users: Record<string, unknown> }).users
  tenantUsers.excludeUsers = [...((tenantUsers.excludeUsers as string[] | undefined) ?? []), person]
  const untouched = { grantControls: structuredClone(row.grantControls), sessionControls: structuredClone(row.sessionControls ?? null), state: row.state }

  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const step = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  const c = stepContract(step, ctx)
  assert.equal(r.steps.find((s) => s.id === 's-prereq-break-glass')?.state.satisfied, true, 'emergency access is not sorted: the premise failed')
  assert.deepEqual(correctionFieldsOf(step, f.snapshot), [], 'source omission must not create a removal of a tenant exception')
  const bindings = packageBindings(step, ctx, c)
  assert.ok((bindings['policy.target.excludeUsers'] as string[]).includes(person), 'the target retains the existing excluded person')
  assert.deepEqual(bindings['policy.target.excludeGroups'], tenantUsers.excludeGroups, 'existing excluded groups are retained')
  assert.deepEqual({ grantControls: row.grantControls, sessionControls: row.sessionControls ?? null, state: row.state }, untouched)
  for (const operation of plannedOperationsOf(step)) {
    const users = (operation.body.conditions as { users?: { excludeUsers?: string[] } } | undefined)?.users
    if (users) assert.ok(users.excludeUsers?.includes(person), 'any conditions request preserves the existing excluded person')
  }

})

test('a two-policy set corrects only the member that differs, creates only the member that is missing, and never touches the sibling that is right (correction batch 2)', () => {
  const pkg = PACKAGES['s-goal-session-lifetime']
  const partial = pkg.meta.projection.partial as { mismatches: Record<string, { member?: string }> } | undefined
  assert.ok(partial, 'the Session Lifetime Partial was withheld at compile time')
  assert.ok(Object.values(partial.mismatches).every((m) => m.member === 'browser' || m.member === 'unmanaged'), 'a module is not scoped to its member')
  const REPORT_ONLY = 'enabledForReportingButNotEnforced'
  const set = {
    'tenant.displayName': 'Contoso',
    'policy.target.excludeGroups': ['group-1'],
    'policy.target.excludeUsers': ['user-1'],
    'policies.session.browser.target.displayName': 'Browser sessions',
    'policies.session.unmanaged.target.displayName': 'Unmanaged sessions',
    'policies.session.browser.operation': 'update',
    'policies.session.unmanaged.operation': 'update',
    'policies.session.browser.current.id': 'policy-browser',
    'policies.session.unmanaged.current.id': 'policy-unmanaged',
    'policies.session.browser.current.state': REPORT_ONLY,
    'policies.session.unmanaged.current.state': REPORT_ONLY,
  }
  const runtime = { satisfied: new Set<string>(), baselineCommit: null }
  const blocksOf = (bindings: Record<string, unknown>) => {
    const p = projectSafely(pkg, 'partial', bindings, runtime)
    return { p, blocks: new Set([...p.channels.flatMap((c) => c.blocks), ...(p.channels.find((c) => c.channel === 'powershell')?.runs ?? []).map((r) => `mode:${r.mode}`)]) }
  }
  // One member wrong, the other right: only the wrong member's correction.
  const one = blocksOf({ ...set, [CHANGED_FIELDS_BINDING]: ['sessionControls.signInFrequency.value'], 'policies.session.browser.current.changedFields': ['sessionControls.signInFrequency.value'] })
  assert.deepEqual(one.p.hold, null, JSON.stringify(one.p.hold))
  assert.ok(one.blocks.has('json.browser.session') && one.blocks.has('mode:CorrectBrowserSession'), [...one.blocks].join(', '))
  assert.equal([...one.blocks].some((b) => /unmanaged|Unmanaged|conditions|create|report-only/.test(b)), false, `a healthy sibling or an unchanged field was corrected: ${[...one.blocks].join(', ')}`)
  // Both wrong, in different fields: each member's own correction, and nothing else.
  const both = blocksOf({ ...set, [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups', 'sessionControls.signInFrequency.value'], 'policies.session.browser.current.changedFields': ['sessionControls.signInFrequency.value'], 'policies.session.unmanaged.current.changedFields': ['conditions.users.excludeGroups'] })
  assert.ok(both.blocks.has('entra.correct.browser.session') && both.blocks.has('entra.correct.unmanaged.conditions'), [...both.blocks].join(', '))
  assert.equal(both.blocks.has('entra.correct.browser.conditions') || both.blocks.has('entra.correct.unmanaged.session'), false, [...both.blocks].join(', '))
  assert.ok(both.p.degraded?.some((d) => d.channel === 'json'), 'two policies’ bodies were merged into one request')
  // Both right: nothing is selected, and nothing is offered.
  const none = projectSafely(pkg, 'partial', set, runtime)
  assert.deepEqual(none.channels, [])
  // One member missing beside a healthy one: create that member only.
  const missing = blocksOf({ ...set, 'policies.session.unmanaged.operation': 'create', 'policies.session.unmanaged.current.id': undefined, 'policies.session.unmanaged.current.state': undefined })
  assert.ok(missing.blocks.has('json.unmanaged.create') && missing.blocks.has('mode:CreateUnmanaged'), [...missing.blocks].join(', '))
  assert.equal([...missing.blocks].some((b) => /browser\.create|CreateBrowser|mode:Create$|entra\.create-set/.test(b)), false, `the healthy member was created again: ${[...missing.blocks].join(', ')}`)
  // Cycle 3 (C02, RUN-CONTEXT): a live member that differs keeps its state. It used to go back to
  // report-only beside its correction; now only its correction is drawn, and saving it is described.
  const live = blocksOf({ ...set, 'policies.session.browser.current.state': 'enabled', [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.session.browser.current.changedFields': ['conditions.users.excludeGroups'] })
  assert.ok(live.blocks.has('entra.correct.browser.conditions'), [...live.blocks].join(', '))
  assert.equal([...live.blocks].some((b) => /lifecycle|report-only|ReportOnly/.test(b)), false, `a correction moved a live policy to report-only: ${[...live.blocks].join(', ')}`)
  assert.match(live.p.channels.find((c) => c.channel === 'entra')?.text ?? '', /If it is On, the changed rule can affect access after you save\./)
  // A change the set reports that no member accounts for belongs to nobody IAMAI can name: it holds.
  const stray = projectSafely(pkg, 'partial', { ...set, [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] }, runtime)
  assert.deepEqual(stray.hold?.unknownMismatches, ['grantControls.builtInControls'])
  assert.deepEqual(stray.channels, [])
})

test('Partial is never the state of a source conflict, a question for a person, or a step that implements nothing', () => {
  let checked = 0
  for (const name of ['demo', 'demo-week2', 'small', 'getiamai'] as const) {
    const { f, r, ctx } = plan(name)
    for (const step of r.steps) {
      if (!implementationPackageFor(step)) continue
      const c = stepContract(step, ctx)
      const now = packageStateOf(step, c, f.snapshot)
      const planned = plannedPackageStateOf(step, c, f.snapshot)
      if (c.state.condition === 'baseline-conflict') {
        assert.equal(now, 'sourceConflict', `${name}/${step.id}`)
        assert.equal(planned, null, `${name}/${step.id}: a contradiction planned a correction`)
        checked++
      }
      if (c.state.condition === 'needs-decision') {
        assert.equal(now, 'needsDecision', `${name}/${step.id}`)
        checked++
      }
      if (step.kind !== 'create' && step.kind !== 'adjust') assert.notEqual(planned, 'partial', `${name}/${step.id}: a ${step.kind} step planned a policy correction`)
    }
  }
  assert.ok(checked > 0, 'no conflict or decision in the fixtures: the premise is untested')
})
