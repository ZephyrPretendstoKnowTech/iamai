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

test('the step exists only when a directory-role holder reads mail or joins Teams on the same account, and lists them', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const with_ = adminsWithWorkloadOf(f.snapshot, new Set(f.mapping.breakGlassUserIds))
  assert.equal(with_.length, 2, 'two of the demo admins use their admin account for Teams or Outlook')
  for (const [id] of with_) assert.ok(adminUserIds(f.snapshot.roles).has(id))
  const s = r.steps.find((x) => x.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID)!
  assert.ok(s, 'the step is on the demo plan')
  assert.equal(s.kind, 'check')
  assert.deepEqual([...s.population.ids].sort(), with_.map(([id]) => id).sort(), 'its population is those admins')
  const cs = stepById[SEPARATE_ADMIN_ACCOUNTS_STEP_ID]
  assert.equal(cs.title, TITLE)
  assert.equal(cs.skip, true, 'skippable')
  assert.match(cs.learn?.url ?? '', /privileged-access/, "Microsoft's privileged-access guidance")
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const ex = stepVars(s, ctx) as { adminsWithWorkload: string[]; n: number }
  assert.equal(ex.adminsWithWorkload.length, 2)
  for (const row of ex.adminsWithWorkload) assert.match(row, /^.+ · (Outlook|Microsoft Teams)/, row)
  assert.ok(stepLines(s, ctx).some((l) => /^2 people hold a directory role and use that same account for mail or Teams since/.test(l)), 'the lead counts them')
  // Nobody on GetIAMAI signs in to mail or Teams in the records: no step.
  const g = fixture('getiamai')
  assert.equal(runFixture(g).steps.some((x) => x.id === SEPARATE_ADMIN_ACCOUNTS_STEP_ID), false)
})

test('steps 15, 23 and 33 name the same people beside the step instead of assuming separate accounts', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  for (const goalId of ['admins-phishing-resistant', 'admin-session', 'pim-activation-reauth']) {
    const cs = stepById[goalId] as unknown as { who: { evidence: string[] } }
    assert.ok(cs.who.evidence.some((l) => l.includes(`see ${TITLE}: {list:adminsWithWorkload}`)), `${goalId}: the evidence names the step`)
    const s = r.steps.find((x) => x.goalId === goalId)
    if (!s) continue // pim needs P2, which the demo does not hold
    assert.ok(stepLines(s, ctx).some((l) => /^2 of them use the same account for mail or Teams; see Use Separate Accounts for Admin Work/.test(l)), `${goalId}: the line renders with the count`)
  }
  const email = (stepById['admins-phishing-resistant'] as unknown as { comms: { body: string } }).comms.body
  assert.ok(email.includes('Everyday work on a separate account is unaffected.'), 'the admin email no longer assumes the account is separate')
})
