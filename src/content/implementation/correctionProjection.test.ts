// Partial, generically (correction batch 1): a mapped policy whose material
// fields differ from the plan is corrected by the modules those fields select,
// in every policy package that authors a correction — not only the pilot's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { UNRESOLVED, present, projectImplementation, projectSafely, selectMismatches } from './project.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { referenceOptions } from '../../roadmap/answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from '../../roadmap/sourceMappings.ts'
import { nextSafeAction } from '../../roadmap/nextSafeAction.ts'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
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

test('an enforced policy whose exclusions differ plans the conditions correction only, and once its references are settled projects it as an executable PATCH while emergency access remains a readiness prerequisite', () => {
  // an enforced policy whose exclusions differ from the plan plans the conditions correction, and only that
  {
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
  }
  // a real enforced policy missing its exclusions projects an executable correction of those conditions only, while emergency access remains a readiness prerequisite
  {
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
  }
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

// Correction batch 2's member scoping is the engine's rule, and since V1 audit S4-10
// removed Limit How Long Sessions Last's unmanaged-device companion (the pin maps that
// goal to one member) no shipped package has two members whose modules differ, so the
// rule is read where it lives: selectMismatches, on a table of its own.
test('a module scoped to a member reads that member’s changed fields, never the set’s, so the sibling that is right is not touched (correction batch 2)', () => {
  const table = {
    mode: 'composeByMismatch',
    mismatches: {
      'a.missing': { member: 'a', select: { equals: ['policies.pair.a.operation', 'create'] } },
      'a.session': { member: 'a', facts: ['sessionControls'] },
      'b.conditions': { member: 'b', facts: ['conditions'] },
      'b.session': { member: 'b', facts: ['sessionControls'] },
    },
  }
  const select = (bindings: Record<string, unknown>) => selectMismatches(table, { state: 'partial', bindings, satisfied: new Set<string>(), baselineCommit: null })
  const CHANGED_A = 'policies.pair.a.current.changedFields'
  const CHANGED_B = 'policies.pair.b.current.changedFields'
  // One member wrong, the other right: only the wrong member's correction, although the set reports the field.
  assert.deepEqual(select({ [CHANGED_FIELDS_BINDING]: ['sessionControls.signInFrequency.value'], [CHANGED_A]: ['sessionControls.signInFrequency.value'], [CHANGED_B]: [] }), { selected: ['a.session'], unknown: [] })
  // Both wrong, in different fields: each member's own module, and neither the other's.
  assert.deepEqual(select({ [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups', 'sessionControls.signInFrequency.value'], [CHANGED_A]: ['sessionControls.signInFrequency.value'], [CHANGED_B]: ['conditions.users.excludeGroups'] }), { selected: ['a.session', 'b.conditions'], unknown: [] })
  // One member missing beside a healthy one: that member's create alone.
  assert.deepEqual(select({ 'policies.pair.a.operation': 'create', [CHANGED_A]: [], [CHANGED_B]: [] }), { selected: ['a.missing'], unknown: [] })
  // Both right: nothing is selected.
  assert.deepEqual(select({ [CHANGED_A]: [], [CHANGED_B]: [] }), { selected: [], unknown: [] })
  // A change the set reports that no member's own changes account for belongs to nobody IAMAI can name.
  assert.deepEqual(select({ [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'], [CHANGED_A]: [], [CHANGED_B]: [] }), { selected: [], unknown: ['grantControls.builtInControls'] })
})

test('Limit How Long Sessions Last corrects the one pinned policy, field by field, and has no second member to correct (S4-10)', () => {
  const pkg = PACKAGES['s-goal-session-lifetime']
  const partial = pkg.meta.projection.partial as { mismatches: Record<string, { member?: string }> } | undefined
  assert.ok(partial, 'the Session Lifetime Partial was withheld at compile time')
  // The pin maps all-users-no-persistence to one member, so every module is the browser policy's.
  assert.deepEqual([...new Set(Object.values(partial.mismatches).map((m) => m.member))], ['browser'])
  const REPORT_ONLY = 'enabledForReportingButNotEnforced'
  const set = {
    'tenant.displayName': 'Contoso',
    'policy.target.excludeGroups': ['group-1'],
    'policy.target.excludeUsers': ['user-1'],
    'policies.session.browser.target.displayName': 'Browser sessions',
    'policies.session.browser.target.sessionControls': { signInFrequency: { isEnabled: true, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication', type: 'hours', value: 12 }, persistentBrowser: { isEnabled: true, mode: 'never' }, applicationEnforcedRestrictions: null, cloudAppSecurity: null, disableResilienceDefaults: null },
    'policies.session.browser.operation': 'update',
    'policies.session.browser.current.id': 'policy-browser',
    'policies.session.browser.current.state': REPORT_ONLY,
  }
  const runtime = { satisfied: new Set<string>(), baselineCommit: null }
  const blocksOf = (bindings: Record<string, unknown>) => {
    const p = projectSafely(pkg, 'partial', bindings, runtime)
    return { p, blocks: new Set([...p.channels.flatMap((c) => c.blocks), ...(p.channels.find((c) => c.channel === 'powershell')?.runs ?? []).map((r) => `mode:${r.mode}`)]) }
  }
  // One field wrong: only that field's correction, and no companion anywhere.
  const one = blocksOf({ ...set, [CHANGED_FIELDS_BINDING]: ['sessionControls.signInFrequency.value'], 'policies.session.browser.current.changedFields': ['sessionControls.signInFrequency.value'] })
  assert.deepEqual(one.p.hold, null, JSON.stringify(one.p.hold))
  assert.ok(one.blocks.has('json.browser.session') && one.blocks.has('mode:CorrectBrowserSession'), [...one.blocks].join(', '))
  assert.equal([...one.blocks].some((b) => /unmanaged|Unmanaged|conditions|create|report-only/.test(b)), false, `an unchanged field was corrected: ${[...one.blocks].join(', ')}`)
  // Nothing wrong: nothing is offered.
  assert.deepEqual(projectSafely(pkg, 'partial', set, runtime).channels, [])
  // The policy missing: the browser create alone, and it is the only create the package has.
  const missing = blocksOf({ ...set, 'policies.session.browser.operation': 'create', 'policies.session.browser.current.id': undefined, 'policies.session.browser.current.state': undefined })
  assert.ok(missing.blocks.has('json.browser.create') && missing.blocks.has('mode:CreateBrowser'), [...missing.blocks].join(', '))
  assert.equal([...missing.blocks].some((b) => /unmanaged|Unmanaged|mode:Create$/.test(b)), false, `a second policy was created: ${[...missing.blocks].join(', ')}`)
  // Cycle 3 (C02, RUN-CONTEXT): a live member that differs keeps its state. It used to go back to
  // report-only beside its correction; now only its correction is drawn, and saving it is described.
  const live = blocksOf({ ...set, 'policies.session.browser.current.state': 'enabled', [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.session.browser.current.changedFields': ['conditions.users.excludeGroups'] })
  assert.ok(live.blocks.has('entra.correct.browser.conditions'), [...live.blocks].join(', '))
  assert.equal([...live.blocks].some((b) => /lifecycle|report-only|ReportOnly/.test(b)), false, `a correction moved a live policy to report-only: ${[...live.blocks].join(', ')}`)
  assert.match(live.p.channels.find((c) => c.channel === 'entra')?.text ?? '', /If it is On, the changed rule can affect access after you save\./)
  // A change no module accounts for belongs to nobody IAMAI can name: it holds.
  const stray = projectSafely(pkg, 'partial', { ...set, [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] }, runtime)
  assert.deepEqual(stray.hold?.unknownMismatches, ['grantControls.builtInControls'])
  assert.deepEqual(stray.channels, [])
})

test('Partial is never the state of a source conflict, a question for a person, or a step that implements nothing', () => {
  let checked = 0
  // The questions that used to sit on policy steps (the device plan, mail devices, device code) are
  // Direction's now, and a policy waiting on one is Blocked, not Needs decision (lifecycle.ts
  // conditionFor). The decision a person still owes on a packaged step is the exclusions group's.
  const unanswered = (() => { const f = noExclusionsAnswer(fixture('demo-week2')); const r = runFixture(f); return { f, r, ctx: { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } as StepVarContext } })()
  for (const name of ['demo', 'demo-week2', 'small', 'getiamai', 'demo-week2+unanswered'] as const) {
    const { f, r, ctx } = name === 'demo-week2+unanswered' ? unanswered : plan(name)
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
