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
  assert.equal(cs.skip, true, 'skippable')
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
  // Missing mail or Teams activity does not remove the administrator review.
  const g = fixture('getiamai')
  assert.equal(runFixture(g).steps.find((x) => x.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID)?.state.satisfied, false, 'a missing business-activity signal does not prove dedicated use')
})
