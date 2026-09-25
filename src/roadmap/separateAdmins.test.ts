// Separate admin accounts (E6): a Preparation check step, Use Separate Accounts
// for Admin Work, shown only when a directory-role holder also has mail or Teams
// sign-ins on the same account; it lists them, is skippable, and carries
// Microsoft's privileged-access guidance; the three admin policies name the
// same people beside it instead of assuming separate accounts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { SEPARATE_ADMIN_ACCOUNTS_STEP_ID } from './stepIds.ts'
import { adminsWithWorkloadOf } from '../derive/contentLists.ts'
import { adminUserIds } from '../roles.ts'
import { stepById } from '../content/content.ts'
import { stepLines } from '../ui/surfaces/stepExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { sectionThreeTasksOf } from '../ui/surfaces/sectionThreeTasks.ts'

const TITLE = 'Use Separate Accounts for Admin Work'

test('the review includes role holders and separately lists observed mail or Teams activity', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const with_ = adminsWithWorkloadOf(f.snapshot, new Set(f.mapping.breakGlassUserIds))
  assert.equal(with_.length, 2, 'two of the demo admins use their admin account for Teams or Outlook')
  for (const [id] of with_) assert.ok(adminUserIds(f.snapshot.roles).has(id))
  const s = r.steps.find((x) => x.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID)!
  assert.ok(s, 'the step is on the demo plan')
  assert.equal(s.kind, 'check')
  assert.ok(with_.every(([id]) => s.population.ids.includes(id)), 'the review includes the administrators with observed business activity')
  const cs = stepById[SEPARATE_ADMIN_ACCOUNTS_STEP_ID]
  assert.equal(cs.title, TITLE)
  // Ongoing Checks and Cleanup (docs/plans/ongoing-spec.md sections 3 and 9): the
  // Learn link moved from the privileged-access-workstations concept page to the one
  // that carries the instruction — personal email is phished constantly, so the
  // account that opens mail should not hold a directory role. That page is also
  // where the two counts the procedure reviews against come from.
  assert.equal(cs.learn?.url, 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-planning', "Microsoft's secure-access guidance for administrators")
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const ex = stepVars(s, ctx) as { adminsWithWorkload: string[]; n: number }
  assert.equal(ex.adminsWithWorkload.length, 2)
  for (const row of ex.adminsWithWorkload) assert.match(row, /^.+ · (Outlook|Microsoft Teams)/, row)
  assert.ok(stepLines(s, ctx).some((l) => /^Review the \d+ administrator accounts for dedicated administration/.test(l)), 'the lead counts them')
})

test('the role is assigned the way the licence offers it: Roles & admins without PIM, Privileged Identity Management with it', () => {
  // Owner audit, 2026-09-24: the line said "choose Assignment type: Active" on
  // Roles & admins, a choice that page offers only where PIM is licensed.
  const f = fixture('demo')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID)!
  const lines = (pim: boolean): string[] => {
    const snapshot = structuredClone(f.snapshot)
    snapshot.capabilities.pim = { ...snapshot.capabilities.pim, enabled: pim }
    snapshot.roles.eligible = {}
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups }
    return sectionThreeTasksOf(s, ctx)!.tasks.flatMap((t) => t.steps).filter((l) => /Add assignments/.test(l))
  }
  const direct = lines(false)
  assert.ok(direct.length > 0, 'the premise: the procedure assigns a role')
  for (const l of direct) {
    assert.match(l, /^Open \*\*Entra ID → Roles & admins → .+ → Add assignments\*\*, select \*\*.+\*\*, and complete the assignment\. If it asks for an assignment type, choose \*\*Active\*\* and \*\*Permanently assigned\*\*\.$/, l)
  }
  const pim = lines(true)
  assert.ok(pim.length > 0)
  for (const l of pim) {
    assert.match(l, /^Open \*\*ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles → .+ → Add assignments\*\*, select \*\*.+\*\*\. Choose \*\*Assignment type: Active\*\* and \*\*Permanently assigned\*\*\.$/, l)
  }
})
