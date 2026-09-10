// One answer for who an account is (Step 2: canonical identity and population
// truth). The emergency accounts are the operator's confirmed choice by object id,
// the exclusions group is the operator's choice this scan read, and the active
// people are one set — asserted across the consumers that read them, on the demo
// (both snapshots) and on live-shaped tenants: an unconfirmed Breakglass, a
// confirmed group that is gone, a partial reading with one plausible group.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from './roadmap/fixtures/index.ts'
import type { Fixture } from './roadmap/fixtures/index.ts'
import { runFixture } from './roadmap/fixtures/run.ts'
import { accountKinds, activeUsers, notPeopleIds, personAccounts } from './derive/sets.ts'
import { activePeopleIds, campaignIdsFor } from './derive/population.ts'
import { facts } from './derive/facts.ts'
import { ladder } from './derive/ladder.ts'
import { readinessView } from './derive/mfaReadiness.ts'
import { sharedDeviceIds } from './derive/sharedDevices.ts'
import { emergencySelection } from './mapping/emergencyChoice.ts'
import { EXCLUSIONS_RECORD_KEY, actionableExclusionsGroupId, awaitsOperator, directoryEvidenceFromGroups, exclusionsGroupChoice } from './mapping/safetyChoice.ts'
import type { DirectoryEvidence } from './mapping/safetyChoice.ts'
import type { MappingState } from './mapping/types.ts'
import { toCoverageMapping } from './mapping/store.ts'
import { computeCoverage } from './coverage/coverage.ts'
import { buildStrengthLookup } from './coverage/strength.ts'
import { breakGlassFindings, buildContext } from './validation/report.ts'
import { stepVars } from './ui/surfaces/stepVars.ts'
import type { StepVarContext } from './ui/surfaces/stepVars.ts'
import { appliedMapping, pickerVars } from './ui/surfaces/pickerRows.ts'
import { BREAK_GLASS_STEP_ID, PREREQ_STEP_ID } from './roadmap/stepIds.ts'
import { SERVICE_ACCOUNTS_TRUSTED_GOAL } from './roadmap/generate.ts'
import type { Step } from './roadmap/types.ts'

const sorted = (ids: readonly string[]): string[] => [...ids].sort()

function coverageOf(f: Fixture, mapping: MappingState, exclusionsGroupId: string | null) {
  return computeCoverage({
    snapshot: f.snapshot,
    tenantPolicies: f.snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: f.baseline.policies,
    baselineUnusable: f.baseline.report.warnings,
    strengths: buildStrengthLookup(f.snapshot.config.authStrengths?.rows ?? []),
    groupMembers: f.groups,
    mapping: toCoverageMapping(mapping, exclusionsGroupId),
  })
}

function varsOf(step: Step, f: Fixture, mapping: MappingState, directory: DirectoryEvidence, groups = f.groups): Record<string, unknown> {
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping, nameOf: (id) => f.snapshot.users.find((u) => u.id === id)?.displayName ?? groups.get(id)?.displayName ?? id, signature: 'IT', operatorId: null, now: f.snapshot.asOf, groups, directory }
  return stepVars(step, ctx)
}

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `the plan has ${id}`)
  return s
}

// ---- the people ----

for (const name of ['demo', 'demo-week2'] as const) {
  test(`${name}: every derivation of the active people counts the same set`, () => {
    const f = fixture(name)
    const notPeople = notPeopleIds(f.mapping)
    const active = facts(f.snapshot, f.mapping).active
    assert.equal(activePeopleIds(f.snapshot, f.snapshot.asOf, notPeople).length, active, 'the plan’s active people (tracking) are the facts’ active people')
    assert.equal(campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, active, 'the campaign counts the same people')
    assert.equal(activeUsers(f.snapshot, f.snapshot.asOf, notPeople).length, active, 'the sets module counts the same people')
    assert.equal(readinessView(f.snapshot, f.snapshot.asOf, f.mapping).facts.active, active, 'MFA Readiness counts the same people')
    const run = runFixture(f)
    assert.equal(run.viability.filter((v) => v.activity === 'active').length, active, 'the plan scores exactly those active people')
  })

  test(`${name}: no account that is not a person reaches a scored row or a step's people`, () => {
    const f = fixture(name)
    const kinds = accountKinds(f.snapshot, f.mapping)
    const run = runFixture(f)
    for (const v of run.viability) assert.equal(kinds.get(v.userId), 'person', `${v.userId} is scored as a person`)
    for (const s of run.steps) {
      // Two steps are about accounts that are not people, and name exactly those: the shared devices, and the service accounts (generate.ts).
      if (s.id === 's-shared-devices' || s.goalId === SERVICE_ACCOUNTS_TRUSTED_GOAL) continue
      for (const p of [s.population, s.cohort ?? null]) {
        for (const id of p?.activeIds ?? []) assert.equal(kinds.get(id), 'person', `${s.id}: ${id} is counted among its people`)
      }
    }
  })

  test(`${name}: the shared device is a shared device on every surface`, () => {
    const f = fixture(name)
    const shared = sharedDeviceIds(f.snapshot)
    assert.ok(shared.length > 0, 'the demo has a shared device')
    const kinds = accountKinds(f.snapshot, f.mapping)
    const people = new Set(personAccounts(f.snapshot, notPeopleIds(f.mapping)).map((u) => u.id))
    const listed = new Set(ladder(f.snapshot, f.mapping, f.snapshot.asOf).kinds.shared.map((u) => u.id))
    const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows
    for (const id of shared) {
      assert.equal(kinds.get(id), 'shared')
      assert.ok(!people.has(id), 'not a person')
      assert.ok(listed.has(id), 'listed by kind on the ladder')
      assert.equal(rows.find((r) => r.user.id === id)?.kind, 'shared', 'and on MFA Readiness')
    }
  })
}

// ---- emergency access ----

test('a nominated emergency account is a person until the operator chooses it', () => {
  const f = fixture('demo')
  const nominated = sorted(f.mapping.breakGlassUserIds)
  // The live shape: nobody has saved the emergency step, and a policy excludes the first account by name.
  const unconfirmed: MappingState = { ...f.mapping, breakGlassUserIds: [], assumed: { ...(f.mapping.assumed ?? {}), breakGlass: 'detected' }, wizardAnswered: { ...f.mapping.wizardAnswered, breakGlass: false } }
  const sel = emergencySelection({ snapshot: f.snapshot, mapping: unconfirmed })
  assert.deepEqual(sorted(sel.recommendedIds), nominated, 'the signals recommend them')
  assert.deepEqual(sel.confirmedIds, [], 'and nobody has chosen them')
  const applied = appliedMapping({ snapshot: f.snapshot, mapping: unconfirmed, nameOf: (id) => id, groups: f.groups, now: f.snapshot.asOf }, null)
  assert.deepEqual(applied.breakGlassUserIds, [], 'the mapping every surface reads holds none')
  const kinds = accountKinds(f.snapshot, applied)
  for (const id of nominated) assert.equal(kinds.get(id), 'person', `${id} is a person`)
  assert.deepEqual(buildContext({ snapshot: f.snapshot, state: applied }).breakGlassIds, [], 'the checks validate no emergency account')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, applied).rows
  for (const id of nominated) assert.equal(rows.find((r) => r.user.id === id)?.kind, 'person', 'MFA Readiness lists a person')
  // Coverage no longer reads a directly excluded account as emergency access while a Setup answer is outstanding.
  const directlyExcluded = ((f.snapshot.config.caPolicies?.rows ?? []) as { conditions?: { users?: { excludeUsers?: string[] } } }[]).flatMap((p) => p.conditions?.users?.excludeUsers ?? [])
  assert.ok(nominated.some((id) => directlyExcluded.includes(id)), 'the day-one tenant excludes an emergency account by name')
  const report = coverageOf(f, applied, actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: applied, groups: f.groups }))
  assert.equal(report.assumed.users.size, 0, 'coverage assumes no emergency account')
  for (const r of report.results) {
    for (const reason of r.reasons) assert.ok(!(reason.role ?? '').includes('breakGlass') || !reason.userIds.some((id) => nominated.includes(id)), `${r.goal.id}: an unconfirmed account is not an expected break-glass exclusion`)
  }
})

test('a confirmed emergency account is the same accounts on every consumer', () => {
  const f = fixture('demo')
  const applied = appliedMapping({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, groups: f.groups, now: f.snapshot.asOf }, f.decisions)
  const confirmed = sorted(applied.breakGlassUserIds)
  assert.equal(confirmed.length, 2)
  const kinds = accountKinds(f.snapshot, applied)
  for (const id of confirmed) assert.equal(kinds.get(id), 'emergency')
  assert.deepEqual(sorted(emergencySelection({ snapshot: f.snapshot, mapping: applied }).confirmedIds), confirmed, 'the picker ticks them')
  assert.deepEqual(sorted(ladder(f.snapshot, applied, f.snapshot.asOf).kinds.emergency.map((u) => u.id)), confirmed, 'the ladder lists them')
  assert.deepEqual(sorted(readinessView(f.snapshot, f.snapshot.asOf, applied).rows.filter((r) => r.kind === 'emergency').map((r) => r.user.id)), confirmed, 'MFA Readiness lists them')
  assert.deepEqual(sorted(buildContext({ snapshot: f.snapshot, state: applied }).breakGlassIds), confirmed, 'the checks validate them')
  assert.deepEqual(sorted([...coverageOf(f, applied, null).assumed.users]), confirmed, 'coverage expects them')
  const people = new Set(personAccounts(f.snapshot, notPeopleIds(applied)).map((u) => u.id))
  for (const id of confirmed) assert.ok(!people.has(id), 'and no people population holds them')
  assert.ok(runFixture(f).viability.every((v) => !confirmed.includes(v.userId)), 'the plan scores none of them')
})

test('a confirmed emergency id the scan holds no account for stands as the choice, fails its own checks, and never moves to a namesake', () => {
  const f = fixture('demo')
  const [kept, gone] = f.mapping.breakGlassUserIds
  const departed = f.snapshot.users.find((u) => u.id === gone)
  assert.ok(departed)
  // The account was deleted and a new one made with the same name and address.
  const namesake = { ...departed, id: 'new-account-object-id' }
  const active = { ...f.snapshot.roles.active }
  delete active[gone]
  const snapshot = { ...f.snapshot, users: [...f.snapshot.users.filter((u) => u.id !== gone), namesake], roles: { ...f.snapshot.roles, active } }
  const sel = emergencySelection({ snapshot, mapping: f.mapping })
  assert.deepEqual(sel.confirmedIds, [kept, gone], 'the decision is the operator’s and a scan does not edit it (rescanDurability 043.5b)')
  assert.ok(!sel.confirmedIds.includes(namesake.id), 'a name is not an identity')
  assert.equal(accountKinds(snapshot, f.mapping).get(namesake.id), 'person', 'the new account is a person until chosen')
  assert.deepEqual(ladder(snapshot, f.mapping, snapshot.asOf).kinds.emergency.map((u) => u.id), [kept], 'only an account the scan read is listed as emergency access')
  const findings = breakGlassFindings({ snapshot, state: f.mapping, groupMembers: [...f.groups].map(([groupId, g]) => ({ groupId, ...g })) })
  assert.ok((findings[gone]?.toFix ?? 0) > 0, 'the missing account fails its own checks, by id: the plan fails closed')
  assert.ok(!(namesake.id in findings), 'and the namesake is checked as nothing')
})

// ---- the exclusions group ----

for (const name of ['demo', 'demo-week2'] as const) {
  test(`${name}: every consumer resolves the same confirmed exclusions group, full reading or the app's partial one`, () => {
    const f = fixture(name)
    const stored = f.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId as string
    for (const universe of ['complete', 'partial'] as const) {
      const directory = directoryEvidenceFromGroups(f.groups, universe)
      const id = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory })
      assert.equal(id, stored, `${universe}: the confirmed group, read this scan, is actionable`)
      const run = runFixture(f, { directory })
      assert.ok(run.coverage.assumed.groups.has(stored), `${universe}: coverage names it`)
      const ge = stepOf(run.steps, PREREQ_STEP_ID.exclusionsGroup)
      const bg = stepOf(run.steps, BREAK_GLASS_STEP_ID)
      const geVars = varsOf(ge, f, f.mapping, directory)
      assert.equal(geVars.exclusionsGroup, f.groups.get(stored)?.displayName, `${universe}: the exclusions step names it`)
      assert.deepEqual(pickerVars(PREREQ_STEP_ID.exclusionsGroup, '{name}', { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => x, groups: f.groups, directory })?.groupsTicked, [stored], `${universe}: the picker ticks it`)
      // The emergency step's "policies that do not yet exclude the exclusions group" is that group's own check.
      const fromCheck = sorted((ge.checks?.items ?? []).filter((it) => it.fix === 'excluded-from-every-policy').flatMap((it) => (Array.isArray(it.values.policies) ? (it.values.policies as string[]) : [])))
      const bgVars = varsOf(bg, f, f.mapping, directory)
      assert.deepEqual(sorted((bgVars.policiesNotExcluding as string[] | undefined) ?? []), fromCheck, `${universe}: both foundation steps name the same policies`)
    }
  })
}

test('a confirmed exclusions group that is gone, or unread, never masquerades — and a namesake is not it', () => {
  const f = fixture('demo')
  const stored = f.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId as string
  const others = new Map([...f.groups].filter(([gid]) => gid !== stored))
  const base = directoryEvidenceFromGroups(others, 'complete')
  const cases: [string, DirectoryEvidence, typeof f.groups, 'invalidated' | 'unverified'][] = []
  // Graph said it is gone.
  const absent = new Map(base.groups)
  absent.set(stored.toLowerCase(), { presence: 'absent', members: 'unknown', displayName: null, memberIds: [], memberCount: null })
  cases.push(['gone', { groups: absent, universe: 'complete' }, others, 'invalidated'])
  // Nothing read it.
  cases.push(['unread', base, others, 'unverified'])
  // A different group carries its name and its members.
  const namesake = new Map(others)
  const was = f.groups.get(stored)
  assert.ok(was)
  namesake.set('another-group-object-id', { ...was })
  cases.push(['namesake', directoryEvidenceFromGroups(namesake, 'complete'), namesake, 'unverified'])
  for (const [label, directory, groups, status] of cases) {
    const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups, directory })
    assert.equal(choice.status, status, label)
    assert.equal(choice.storedId, stored, `${label}: the operator’s answer is kept`)
    assert.equal(choice.actionableId, null, `${label}: and nothing may act on it`)
    assert.ok(choice.candidates.length > 0, `${label}: the candidate evidence is still there`)
    assert.equal(awaitsOperator(choice), status === 'invalidated', `${label}: only a proved-gone group asks the operator again`)
    const run = runFixture({ ...f, groups }, { directory })
    assert.ok(!run.coverage.assumed.groups.has(stored), `${label}: coverage is not told about it`)
    // A group of only the confirmed emergency accounts is an expected exclusion by its membership (coverage.ts); it is never given the exclusions group's place by its name.
    assert.notEqual(run.coverage.assumed.groups.get('another-group-object-id'), 'breakGlass/globalExclusion', `${label}: nor is a namesake`)
    const ge = stepOf(run.steps, PREREQ_STEP_ID.exclusionsGroup)
    assert.notEqual(ge.status, 'done', `${label}: the exclusions step is not In place`)
    for (const s of run.steps) assert.ok(!JSON.stringify(s.action.json ?? null).includes(stored), `${label}: ${s.id} writes no policy naming it`)
  }
})

test('live shape: a partial reading with one plausible group names it, chooses nothing, and does not say a read failed', () => {
  const base = noExclusionsAnswer(fixture('small'))
  // Only the group the tenant's policies already exclude broadly.
  const policyGroups = new Set(((base.snapshot.config.caPolicies?.rows ?? []) as { conditions?: { users?: { excludeGroups?: string[] } } }[]).flatMap((p) => p.conditions?.users?.excludeGroups ?? []))
  const groups = new Map([...base.groups].filter(([gid]) => policyGroups.has(gid)))
  assert.equal(groups.size, 1)
  const [broad] = [...groups.keys()]
  const f: Fixture = { ...base, groups }
  const directory = directoryEvidenceFromGroups(groups, 'partial')
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups, directory })
  assert.equal(choice.status, 'undetermined', 'the app reads only the groups somebody asked for')
  assert.equal(choice.gap, 'universe', 'and every one of those reads succeeded')
  assert.equal(choice.suggested?.id, broad, 'the broadly excluded group is named')
  assert.equal(choice.actionableId, null, 'and not chosen')
  assert.ok(awaitsOperator(choice), 'the operator still answers')
  const run = runFixture(f, { directory })
  const vars = varsOf(stepOf(run.steps, PREREQ_STEP_ID.exclusionsGroup), f, f.mapping, directory, groups)
  assert.deepEqual(vars.suggestedGroup, [groups.get(broad)?.displayName], 'the step names the group IAMAI found')
  assert.equal(vars.detectionGap, undefined, 'it does not say a group would not open')
  assert.equal(vars.createIfNeeded, false, 'nor offer to create a second one')
  assert.notEqual(run.coverage.assumed.groups.get(broad), 'breakGlass/globalExclusion', 'coverage does not treat the candidate as the exclusions group')

  // The same tenant where that group's read failed: now it is a read that came up short, and says so.
  const unread: DirectoryEvidence = { groups: new Map(), universe: 'partial' }
  const failed = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: new Map(), directory: unread })
  assert.equal(failed.gap, 'groups')
  assert.equal(failed.suggested, null, 'an unread group is not a candidate')
  const failedRun = runFixture({ ...f, groups: new Map() }, { directory: unread })
  const failedVars = varsOf(stepOf(failedRun.steps, PREREQ_STEP_ID.exclusionsGroup), f, f.mapping, unread, new Map())
  assert.equal((failedVars.detectionGap as string[] | undefined)?.length, 1, 'the step says which read came up short')
  assert.equal(failedVars.createIfNeeded, true)
})
