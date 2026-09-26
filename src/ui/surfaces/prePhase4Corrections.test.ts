// The corrections found by the live audit before Phase 4 (2026-09-26): a create
// lands in Report-only under the baseline's name; Create the Policies in
// Report-only lists no user-action policy; a report-only wait names who it
// would have stopped; the Accept panel names the setting the step's own
// correction writes; conditions lean; guest types are named; risk remediation
// has words.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { createdOn } from '../../roadmap/evidenceStrategy.ts'
import { REPORT_ONLY_STEP_ID } from '../../roadmap/reportOnlyBatch.ts'
import { differencePieces } from '../../roadmap/differences.ts'
import { sameDimension } from '../../roadmap/observation.ts'
import { createLines } from '../../roadmap/policyProcedure.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepBodyOf } from './stepBody.ts'
import { acceptPanelOf } from './acceptPanel.ts'
import { actionWordsOf } from './policyFact.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

type Row = Record<string, any>
const ON = 'Set **Enable policy** to **On** and select **Create**.'

function ctxOf(f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, planSteps: r.steps, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
}

test('a create lands in Report-only under the baseline’s name, whatever state and name the tenant’s policy has', () => {
  let corrected = 0
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const ctx = ctxOf(f, r)
    for (const step of r.steps) {
      const create = stepBodyOf(step, ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'create')
      if (!create) continue
      const on = (step.action.resolution?.policies ?? []).some((op) => createdOn(op.body))
      assert.equal(create.steps.includes(ON), on, `${f.name}/${step.id}: a create is On only where it is created On`)
      const ops = step.action.resolution?.policies ?? []
      if (ops.length === 1 && ops[0].mode === 'update' && step.createName) {
        corrected++
        assert.ok(create.steps.some((l) => l.includes(step.createName!)), `${f.name}/${step.id}: the create names ${step.createName}: ${create.steps[1]}`)
      }
    }
  }
  assert.ok(corrected > 0, 'the premise: some step corrects a tenant policy and keeps its create')
})

test('Create the Policies in Report-only never lists a user-action policy, a correction’s included', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const batch = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)?.reportOnlyBatch
    if (!batch) continue
    for (const id of [...batch.create, ...batch.created]) {
      const step = r.steps.find((s) => s.id === id)!
      assert.equal((step.action.resolution?.policies ?? []).some((op) => createdOn(op.body) || createdOn(op.intent) || createdOn(op.target)), false, `${f.name}/${id}`)
    }
  }
})

test('a report-only wait names who report-only would have stopped', () => {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const ctx = ctxOf(f, r)
  const base = r.steps.find((s) => s.id === 's-goal-block-auth-transfer')!
  const person = (f.snapshot.users ?? []).find((u) => u.accountEnabled !== false)!
  const step = { ...base, state: { ...base.state, lifecycle: 'report-only' }, tracking: { ...base.tracking!, failures: 1, failuresByUser: [{ userId: person.id, count: 1 }] } } as Step
  const tasks = stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []
  const text = tasks.flatMap((t) => [t.readinessTitle ?? '', ...t.steps]).join(' | ')
  assert.ok(text.includes(`it would have blocked ${ctx.nameOf(person.id)}`), text)
})

test('the Accept panel says which setting the step’s own correction writes, beside the difference it can accept', () => {
  // Demo's legacy block: its correction writes who it excludes; a location condition added by hand is the difference to accept.
  const f = structuredClone(fixture('demo'))
  const row = (f.snapshot.config.caPolicies.rows as Row[]).find((p) => p.displayName === 'Core - Block - Legacy authentication')!
  row.conditions.locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] }
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  const panel = acceptPanelOf(step, ctxOf(f, r))
  assert.ok(panel, 'the premise: a difference to accept')
  assert.ok(panel!.lines.some((l) => l.tag === 'weaker' && /^Also limited by /.test(l.text)), JSON.stringify(panel!.lines))
  assert.ok(panel!.lines.some((l) => l.tag === 'required' && /must match the baseline's$/.test(l.text)), JSON.stringify(panel!.lines))
})

test('a condition the tenant adds narrows the policy; one it drops widens it', () => {
  const pieces = (plan: Row, tenant: Row) => differencePieces('conditions.locations', { conditions: plan }, { conditions: tenant }, { exclusionsGroupId: null, same: sameDimension }).map((p) => [p.change, p.direction])
  const where = { locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }
  assert.deepEqual(pieces({}, where), [['extra', 'weaker']])
  assert.deepEqual(pieces(where, {}), [['missing', 'stricter']])
  const apps = (types: string[]) => differencePieces('conditions.clientAppTypes', { conditions: { clientAppTypes: ['all'] } }, { conditions: { clientAppTypes: types } }, { exclusionsGroupId: null, same: sameDimension }).map((p) => p.direction)
  assert.deepEqual(apps(['browser']), ['weaker'], 'client apps "all" is no condition')
})

test('every guest type is named, all six included, and Require risk remediation has words', () => {
  const lines = createLines({ conditions: { users: { includeUsers: ['All'], excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider', externalTenants: { membershipKind: 'all' } } } } }, { nameOf: (x) => x }, { name: 'P' })
  const users = lines.find((l) => l.startsWith('Under **Users**')) ?? ''
  for (const t of ['Local guest users', 'B2B collaboration guest users', 'B2B collaboration member users', 'B2B direct connect users', 'Other external users', 'Service provider users']) assert.ok(users.includes(t), `${t}: ${users}`)
  const f = fixture('demo')
  const words = actionWordsOf({ grantControls: { operator: 'AND', builtInControls: ['riskRemediation', 'mfa'] } }, { snapshot: f.snapshot, mapping: f.mapping })
  assert.match(words?.what ?? '', /risk remediation/)
})
