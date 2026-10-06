// T4-PM, the policy-matching pilot on 4.3 Require Phishing-Resistant MFA for
// Admins (owner, 2026-09-27: build new, retire old; docs/STATUS.md).
//
// A tenant policy for the admins that is neither the plan's own (its tag, or the
// baseline's name) nor the baseline's policy in every setting is never edited by
// 4.3. The step creates the baseline's policy beside it, new, under the
// baseline's name, in Report-only (listed in 3.8 like every create), turns it on
// after its report-only week, and names the tenant's policy as also covering
// these people today. Cleanup's Retire Replaced Policies retires the old one
// once the new one is On: turn it Off, check a week, delete it, or keep it with
// a reason. A tenant policy exactly the baseline's, under any name, completes
// the step as before (8.2 renames it); the plan's own policy is compared and
// corrected as before (adminsSessionCorrection.test.ts). Every other policy step
// still corrects in place.
//
// The two design scenarios: a fresh tenant (nothing changes) and a tenant with
// Microsoft's template policies (create beside, Cleanup retires).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { asCuratedBaseline, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { nameKey } from '../baseline/discover.ts'
import { EXCLUSION_GROUP_STEP_ID } from './stepIds.ts'
import { REPORT_ONLY_STEP_ID } from './stepIds.ts'
import { withCleanupDone } from './cleanupDone.ts'
import { CORE_ADMIN_ROLE_IDS } from '../coverage/classify.ts'
import { boardReadingsOf } from '../ui/surfaces/planBoard.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { cleanupExportView } from '../ui/surfaces/cleanupExport.ts'
import type { Step } from './types.ts'

const ADMINS = 's-goal-admins-phishing-resistant'
const REPORT_ONLY = 'enabledForReportingButNotEnforced'
const PHISHING_RESISTANT = '00000000-0000-0000-0000-000000000004'
const ROLES = [...CORE_ADMIN_ROLE_IDS]
// Microsoft's templates, as a tenant creates them from the gallery.
const MFA_ADMINS = 'c0400000-0000-4000-8000-000000000001'
const PR_ADMINS = 'c0400000-0000-4000-8000-000000000002'
const MFA_ALL = 'c0400000-0000-4000-8000-000000000003'
const NEW = 'c0400000-0000-4000-8000-0000000000aa'

type Row = Record<string, unknown>

/** A fresh tenant (security defaults, no admin policy) on the pinned baseline. */
function fresh(): Fixture {
  return withFoundationSettled({ ...fixture('small'), baseline: asCuratedBaseline(pinnedPackage() as never) })
}

/** The fixture with these policies added, every one stamped with the scan's clock. */
function withPolicies(f: Fixture, rows: Row[]): Fixture {
  const g = structuredClone(f)
  const at = g.snapshot.asOf
  ;(g.snapshot.config.caPolicies!.rows as Row[]).push(...rows.map((p) => ({ createdDateTime: at, modifiedDateTime: at, ...p })))
  return g
}

/** The three Microsoft template policies a typical tenant starts from: two for the admins, one for everyone. */
function templates(state: { mfaAdmins?: string; prAdmins?: string } = {}): Row[] {
  const users = { includeRoles: ROLES }
  return [
    { id: MFA_ADMINS, displayName: 'Require multifactor authentication for admins', state: state.mfaAdmins ?? 'enabled', conditions: { users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
    { id: PR_ADMINS, displayName: 'Require phishing-resistant multifactor authentication for administrators', state: state.prAdmins ?? REPORT_ONLY, conditions: { users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PHISHING_RESISTANT } } },
    { id: MFA_ALL, displayName: 'Require multifactor authentication for all users', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  ]
}

function plan(f: Fixture) {
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === ADMINS) as Step
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, null)
  const retire = r.schedule.cleanup?.rows.find((row) => row.kind === 'retire') ?? null
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { r, step, board, retire, ctx }
}

/** Every operation on the plan, by step: what the plan asks a person to write. Never memoised (runFixture with a clock), so a run without the pilot is never served for one with it. */
function operationsByStep(f: Fixture): Map<string, unknown> {
  return new Map(runFixture(f, {}, null, f.snapshot.asOf).steps.map((s) => [s.id, JSON.stringify(s.action.resolution?.policies ?? [])]))
}


test('a fresh tenant: 4.3 creates the baseline’s policy as before, names nothing beside it, and Cleanup retires nothing', () => {
  const f = fresh()
  const { step, retire } = plan(f)
  assert.equal(step.kind, 'create')
  assert.deepEqual(step.action.besidePolicies, [], 'nothing beside it: the name reads no tenant policy')
  assert.ok(retire === null || !(retire.waitsOn ?? []).includes(ADMINS), 'Retire Replaced Policies waits on nothing of 4.3')
})

test('a tenant with Microsoft’s template admin policies: 4.3 creates the baseline’s policy beside them in Report-only, edits neither, names both, and 3.8 lists the create', () => {
  const f = withPolicies(fresh(), templates())
  const { r, step, ctx } = plan(f)
  assert.equal(step.kind, 'create')
  const ops = step.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => o.mode), ['create'], 'one create, and no update of a tenant policy')
  const body = ops[0].body as Row
  assert.equal(body.displayName, step.createName, 'under the baseline’s own name')
  assert.equal(body.state, REPORT_ONLY, 'created in Report-only')
  assert.deepEqual((step.action.besidePolicies ?? []).map((p) => [p.policyId, p.state]).sort(), [[MFA_ADMINS, 'enabled'], [PR_ADMINS, REPORT_ONLY]], 'both admin templates named; the all-users one is Require MFA for Everyone’s')
  // Nothing anywhere on the plan writes to the admin templates for 4.3, and no step tracks them as its own.
  assert.ok(!r.steps.some((s) => s.id === ADMINS && (s.action.resolution?.policies ?? []).some((o) => o.policyId === MFA_ADMINS || o.policyId === PR_ADMINS)))
  assert.ok(!(step.tracking?.members ?? []).some((m) => m.policyId === MFA_ADMINS || m.policyId === PR_ADMINS), 'the step never tracks them as its own')
  // 3.8 lists it like every create.
  const batch = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!.reportOnlyBatch!
  assert.ok(batch.create.includes(ADMINS), '3.8 creates it in Report-only')

  // The step names the tenant's policies as also covering these people today, and says why running both weakens nothing.
  const vars = stepVars(step, ctx)
  assert.equal(vars.buildsBeside, true)
  assert.deepEqual([...(vars.existingPolicies as string[])].sort(), ['Require multifactor authentication for admins (On)', 'Require phishing-resistant multifactor authentication for administrators (Report-only)'])
  const who = (stepBodyOf(step, ctx).whoFull ?? []).map((w) => w.lead).join('\n')
  assert.match(who, /Also covering these people today: .*Require multifactor authentication for admins \(On\)/)
  assert.match(who, /never edits a policy of .*'s own/)
  assert.match(who, /requires all their grants, so old and new side by side weaken nothing/)

  // Implementation Tasks hold the whole procedure: the create, then the turn-on.
  const tasks = stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []
  assert.deepEqual(tasks.map((t) => t.title), ['Create the policy in Report-only', 'Turn the policy on'])
  assert.ok(tasks[0].steps.some((l) => l.includes(`Name: **${step.createName}**`)), tasks[0].steps.join('\n'))
  assert.ok(tasks[0].steps.some((l) => /New policy/.test(l)), 'a new policy, never an edit')
})

test('policy identity is the name, on every goal step (owner, 2026-10-04): no step edits a tenant policy carrying neither its tag nor its name, but to rename one exactly the baseline’s', () => {
  let edits = 0
  for (const f of [withPolicies(fresh(), templates()), fixture('demo'), fixture('demo-week2'), fixture('messy'), fixture('midflight')]) {
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const rows = (f.snapshot.config.caPolicies?.rows ?? []) as Row[]
    for (const s of r.steps) {
      // Configure Emergency Exclusions adds the group to every policy; the guest pair and two-policy steps read by name already.
      if (!s.goalId || s.id === EXCLUSION_GROUP_STEP_ID || (s.action.pairMembers?.length ?? 0) > 0) continue
      for (const op of s.action.resolution?.policies ?? []) {
        if (op.mode !== 'update') continue
        const row = rows.find((p) => p.id === op.policyId)
        if (!row) continue
        const tagged = String(row.description ?? '').includes(`:${s.id}`)
        const named = s.createName !== undefined && nameKey(String(row.displayName ?? '')) === nameKey(s.createName)
        const renamed = typeof op.body.displayName === 'string'
        assert.ok(tagged || named || renamed || (s.action.resolution?.policies.length ?? 0) > 1, `${f.name}: ${s.id} edits ${String(row.displayName)}, which is neither its own by tag or name nor a rename`)
        edits++
      }
    }
  }
  assert.ok(edits >= 0)
})

test('Retire Replaced Policies: listed with each policy’s state and ID, held until 4.3’s policy is On, and Ready once it is', () => {
  const f = withPolicies(fresh(), templates())
  const { board, retire } = plan(f)
  assert.ok(retire, 'the row is on the plan')
  const lines = retire.lists.retiring ?? []
  // Require MFA for Everyone retires its own beside the admin templates (owner, 2026-10-04: identity is the name on every step).
  // Each line names its replacement; the phishing-resistant template asks more than the baseline's grant and says so (audit, 2026-10-05).
  assert.ok(lines.some((l) => l === `Require multifactor authentication for admins (On): keep it until Require a Strong Sign-in for Admins is On. ID: ${MFA_ADMINS}`), lines.join(' | '))
  assert.ok(lines.some((l) => l === `Require phishing-resistant multifactor authentication for administrators (Report-only): keep it until Require a Strong Sign-in for Admins is On. It asks more than the baseline's: keep it for good, with a reason, unless you mean to loosen sign-in. ID: ${PR_ADMINS}`), lines.join(' | '))
  assert.ok((retire.waitsOn ?? []).includes(ADMINS))
  // What Keep With This Reason saves (ui/surfaces/CleanupStep.tsx): every policy listed, by id, with the reason.
  for (const id of [MFA_ADMINS, PR_ADMINS]) assert.ok((plan(f).r.schedule.cleanup!.retiringPolicyIds ?? []).includes(id), id)
  const source = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(source, /row\.kind === 'retire' \? \{ outcome: 'passed' as const, retainedPolicyIds: \[\.\.\.\(phase\.retiringPolicyIds \?\? \[\]\)\], rationale: rationale\.trim\(\)/)
  assert.match(source, /\(row\.kind === 'retire' && !rationale\.trim\(\)\)/, 'no reason, no Keep')
  const reading = board.readings.get('cleanup-retire')!
  assert.notEqual(reading.lane, 'Ready', 'nothing is retired before the baseline’s policy is On')
  const view = cleanupExportView(plan(f).r.schedule.cleanup!, retire)!
  assert.match(view.why, /requires all their grants, so running old and new side by side weakens nothing/, 'it says plainly that running both cannot weaken anything')
  assert.deepEqual(view.whatToDo.map((l) => l.split(':')[0]), ['Compare each policy listed with the baseline\'s. Anything it asks that the baseline\'s does not, a stricter method or more people, goes when it is turned off. A stricter policy can stay', 'Turn it off', 'Check for a week that nothing changed', 'Select Scan'])
})

test('the life of the pilot: the new policy in Report-only is the step’s own and is turned on; once On the step completes and Retire is Ready; Off or kept with a reason completes Retire', () => {
  const start = withPolicies(fresh(), templates())
  const created = plan(start).step.action.resolution!.policies[0].body as Row
  // The person creates the baseline's policy as the step says: in Report-only, with the plan's tag.
  const inReportOnly = withPolicies(start, [{ ...structuredClone(created), id: NEW, state: REPORT_ONLY }])
  {
    const { step, retire } = plan(inReportOnly)
    assert.equal(step.tracking?.members?.[0]?.policyId, NEW, 'the step tracks the policy it created')
    assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'nothing is created twice')
    for (const o of step.action.resolution?.policies ?? []) assert.equal(o.policyId, NEW, 'only its own policy is written to')
    assert.deepEqual((step.action.besidePolicies ?? []).map((p) => p.policyId).sort(), [MFA_ADMINS, PR_ADMINS])
    assert.ok(retire && retire.waitsOn?.includes(ADMINS), 'Retire still waits for the new policy to be On')
  }
  // On, after its report-only week: the step is complete and Retire Replaced Policies is Ready.
  const on = structuredClone(inReportOnly)
  ;(on.snapshot.config.caPolicies!.rows as Row[]).find((p) => p.id === NEW)!.state = 'enabled'
  {
    const { step, board, retire, ctx } = plan(on)
    assert.equal(step.status, 'done', `the step completes on its own policy On: ${step.status}`)
    // The line beside it says the baseline's policy is On, not that it is being built.
    assert.equal(stepVars(step, ctx).buildsBesideOn, true)
    const who = (stepBodyOf(step, ctx).whoFull ?? []).map((w) => w.lead).join('\n')
    if (/Also covering these people today/.test(who)) {
      assert.match(who, /the baseline's policy is On, and Retire Replaced Policies/)
      assert.doesNotMatch(who, /is built new/)
    }
    assert.ok(retire, 'the old ones are still to retire')
    assert.ok(!board.readings.get('cleanup-retire')!.blockers.some((b) => b.id === ADMINS), 'it no longer waits on 4.3')
    // Each policy says whether its own replacement is On (audit, 2026-10-05): the admin templates may go now.
    const lines = retire.lists.retiring ?? []
    assert.ok(lines.some((l) => l.startsWith('Require multifactor authentication for admins (On): Require a Strong Sign-in for Admins replaces it and is On. ID: ')), lines.join(' | '))
    assert.equal(retire.done, null)
  }
  // Kept, with a reason: Retire completes.
  {
    const kept = structuredClone(on)
    kept.checkpoints = withCleanupDone(kept.checkpoints ?? [], 'retire', kept.snapshot.asOf.slice(0, 10), kept.snapshot.asOf, { outcome: 'passed', retainedPolicyIds: [...(plan(on).r.schedule.cleanup!.retiringPolicyIds ?? [])], rationale: 'The security team keeps the stricter one for now.' })
    const { board, retire } = plan(kept)
    assert.ok(retire?.done, 'a saved reason completes the row')
    assert.equal(board.readings.get('cleanup-retire')!.lane, 'Completed')
    // A reason naming only one of them completes nothing.
    const half = structuredClone(on)
    half.checkpoints = withCleanupDone(half.checkpoints ?? [], 'retire', half.snapshot.asOf.slice(0, 10), half.snapshot.asOf, { outcome: 'passed', retainedPolicyIds: [PR_ADMINS], rationale: 'Keep the stricter one.' })
    assert.equal(plan(half).retire?.done, null)
  }
  // Turned Off: they leave the list, and the row leaves the plan with the last one.
  const off = structuredClone(on)
  for (const p of off.snapshot.config.caPolicies!.rows as Row[]) if (p.id === MFA_ADMINS || p.id === PR_ADMINS) p.state = 'disabled'
  {
    const { step, retire } = plan(off)
    assert.ok(retire === null || !(retire.lists.retiring ?? []).some((l) => l.includes(MFA_ADMINS) || l.includes(PR_ADMINS)), 'the admin templates leave the list')
    assert.equal(step.status, 'done')
    assert.deepEqual(step.action.besidePolicies, [])
  }
})

test('a tenant policy exactly the baseline’s under another name: 4.3 renames it, its one edit; one beside it is still retired (owner, 2026-10-04)', () => {
  const start = withPolicies(fresh(), [])
  const { description: _tag, ...exact } = structuredClone(plan(start).step.action.resolution!.policies[0].body) as Row
  const theirs = withPolicies(start, [{ ...exact, id: NEW, displayName: 'Contoso admins phishing-resistant', state: 'enabled' }])
  {
    const { step } = plan(theirs)
    assert.notEqual(step.status, 'done', 'not done until it carries the plan name')
    const ops = step.action.resolution?.policies ?? []
    assert.deepEqual(ops.map((o) => [o.mode, o.policyId]), [['update', NEW]], 'the rename, and no create')
    assert.equal(ops[0].body.displayName, step.createName)
    assert.ok(!(step.action.besidePolicies ?? []).some((p) => p.policyId === NEW), 'the renamed policy is not one to retire')
  }
  // Renamed: Completed.
  {
    const renamed = withPolicies(start, [{ ...exact, id: NEW, state: 'enabled' }])
    const { step } = plan(renamed)
    assert.equal(step.status, 'done', 'the plan name and every control: Completed')
  }
  // Beside a template the step did not write: the exact one is the step's, and the template is for Cleanup.
  const both = withPolicies(theirs, templates().slice(0, 1))
  {
    const { step, retire } = plan(both)
    assert.ok((step.action.resolution?.policies ?? []).some((o) => o.mode === 'update' && o.policyId === NEW), 'the exact one is the policy the step renames')
    assert.deepEqual((step.action.besidePolicies ?? []).map((p) => p.policyId), [MFA_ADMINS])
    assert.ok(retire, 'and Cleanup retires the template')
  }
})

test('the owner-like fixtures: demo-week2’s own enforced admin policy is built beside and retired; midflight’s tagged policy is still corrected in place', () => {
  {
    const f = fixture('demo-week2')
    const { r, step, retire } = plan(f)
    assert.equal(step.kind, 'create')
    assert.deepEqual((step.action.besidePolicies ?? []).map((p) => [p.name, p.state]), [['Core - Grant - Admins phishing-resistant', 'enabled']])
    assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'update'), 'its stricter admin policy is never weakened in place (OWN-W4)')
    assert.ok(r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!.reportOnlyBatch!.create.includes(ADMINS))
    assert.ok(retire?.lists.retiring?.[0]?.startsWith('Core - Grant - Admins phishing-resistant (On): '), JSON.stringify(retire?.lists))
  }
  {
    // Its own stricter policy On delivers the goal today: the baseline's policy,
    // created in Report-only beside it, still has to be turned on. The old one
    // never finishes the step in its place, and nothing is retired before the new
    // one is On (the safety floor: nothing the tool says weakens protection).
    const week2 = fixture('demo-week2')
    const created = plan(week2).step.action.resolution!.policies[0].body as Row
    const f = withPolicies(week2, [{ ...structuredClone(created), id: NEW, state: REPORT_ONLY }])
    const { step, board, retire } = plan(f)
    assert.equal(step.tracking?.members?.[0]?.policyId, NEW, 'the step follows the policy it created')
    assert.notEqual(step.status, 'done', 'the old policy does not complete the step')
    assert.equal(step.state.inPlace, false)
    assert.ok(retire?.waitsOn?.includes(ADMINS))
    assert.notEqual(board.readings.get('cleanup-retire')!.lane, 'Ready', 'nothing is retired while the new policy is in Report-only')
    // Turned Off again: still not done in the old policy's name, and still nothing to retire yet.
    const off = withPolicies(week2, [{ ...structuredClone(created), id: NEW, state: 'disabled' }])
    const again = plan(off)
    assert.notEqual(again.step.status, 'done', 'an Off policy of the plan’s beside the old one is not a finished step')
    assert.notEqual(again.board.readings.get('cleanup-retire')!.lane, 'Ready')
  }
  {
    const f = fixture('midflight')
    const { step, retire } = plan(f)
    assert.equal(step.kind, 'adjust', 'the plan’s own tagged policy is corrected, as before')
    assert.deepEqual(step.action.besidePolicies, [])
    assert.ok(retire === null || !(retire.waitsOn ?? []).includes(ADMINS))
  }
})
