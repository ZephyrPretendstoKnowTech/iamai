// Small engine items (E9): the device-code, authentication-transfer and
// unsupported-platforms blocks are evidence-gated blocks (nobody affected when
// their evidence count is zero) with no device-readiness gate; the admin session
// policy has no admin-readiness gate; the admin-portals step names the Azure
// sign-ins by people with no directory role; step 6's risk names the baseline's
// service-accounts block, which is a step of its own, Restrict Service Accounts
// to the Trusted Network; the manager's "nobody here used it" clause applies
// only when the records show nobody affected.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { SERVICE_ACCOUNTS_TRUSTED_GOAL } from './generate.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { nobodyAffected } from './timing.ts'
import { PINNED_GOAL_MAP, goalMapFor } from './goalMap.ts'
import { PINNED, pinnedPackage } from '../baseline/pinned.ts'
import { mapGoalsToPolicies } from '../coverage/goalIdentity.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { CaPolicy } from '../baseline/types.ts'
import { stepById } from '../content/content.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { managerText, stepExportView, stepLines } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming })

test('the three blocks are evidence-gated with no device-readiness gate; the admin session policy has no admin-readiness gate', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  for (const goalId of ['block-device-code', 'block-auth-transfer', 'block-unsupported-platforms']) {
    const s = r.steps.find((x) => x.goalId === goalId)!
    assert.ok(s, goalId)
    assert.equal(s.readiness.family, 'block', `${goalId} is a block`)
    assert.ok(!s.blockers.some((b) => b.kind === 'readiness' && /readiness/.test(b.label)), `${goalId} is not held by a readiness threshold`)
  }
  // Nobody used device code or authentication transfer on the demo; one sign-in carried no platform.
  const dc = r.steps.find((x) => x.goalId === 'block-device-code')!
  const up = r.steps.find((x) => x.goalId === 'block-unsupported-platforms')!
  assert.equal(nobodyAffected(dc), true)
  assert.equal(up.evidence.affectedUserIds.length, 1, 'the empty-platform sign-in is the evidence')
  assert.equal(nobodyAffected(up), false)
  const session = r.steps.find((x) => x.goalId === 'admin-session')!
  assert.notEqual(session.readiness.family, 'admin')
  assert.ok(!session.blockers.some((b) => b.kind === 'readiness'), 'not held by admin readiness')
})

test("the manager's nobody-here-used-it clause applies only when the records show nobody affected", () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const ctx = ctxFor(f, r)
  const dc = r.steps.find((x) => x.goalId === 'block-device-code')!
  const up = r.steps.find((x) => x.goalId === 'block-unsupported-platforms')!
  assert.match(managerText(stepById['block-device-code'] as unknown as Record<string, unknown>, stepVars(dc, ctx) as Record<string, unknown>)!, /Nobody here used it since /)
  assert.doesNotMatch(managerText(stepById['block-unsupported-platforms'] as unknown as Record<string, unknown>, stepVars(up, ctx) as Record<string, unknown>)!, /Nobody here/)
  // The none line stands in for the usage line, and never beside it.
  const dcLines = stepLines(dc, ctx)
  assert.ok(dcLines.some((l) => /^No device-code sign-ins since /.test(l)))
  const upLines = stepLines(up, ctx)
  assert.ok(upLines.some((l) => /^1 sign-in since .+ carried no platform \(Outlook Mobile\) by /.test(l)), upLines.filter((l) => /platform/.test(l)).join(' | '))
  assert.ok(!upLines.some((l) => /^Every sign-in since/.test(l)))
})

test("step 16's evidence names the Azure sign-ins by people with no directory role", () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.goalId === 'admin-portals-protected')!
  const ex = stepVars(s, ctxFor(f, r)) as { azureNonAdmins: string[] }
  assert.equal(ex.azureNonAdmins.length, 1, 'the developer who opened the Azure portal')
  assert.ok(stepLines(s, ctxFor(f, r)).some((l) => /^1 person without a directory role signed in to Azure since .+: /.test(l)))
})

test('the baseline maps its service-accounts block to the new goal, and the pin script would derive the same map', () => {
  const key = PINNED_GOAL_MAP[SERVICE_ACCOUNTS_TRUSTED_GOAL]
  assert.deepEqual(key, ['99eabebd-877c-4800-aa15-d389b8767760'])
  const forMap = PINNED.policies.map((p) => ({ id: p.id ?? p.displayName, name: p.displayName, facts: policyFacts(p as unknown as CaPolicy, new Map()), placeholders: p.placeholders }))
  const derived = mapGoalsToPolicies(forMap).map
  assert.deepEqual(derived[SERVICE_ACCOUNTS_TRUSTED_GOAL], key, 'the strict identity rule picks the same policy from the pin')
  for (const [g, ids] of Object.entries(PINNED_GOAL_MAP)) assert.deepEqual(derived[g], ids, `${g} maps as the pin says`)
  // Without the pin's tokens (an uploaded baseline) the goal is not mapped: the group cannot be told from any other.
  assert.equal(goalMapFor(pinnedPackage().policies.map((p) => ({ ...p, placeholders: undefined })) as unknown as CaPolicy[], new Map()).map[SERVICE_ACCOUNTS_TRUSTED_GOAL], undefined)
})

test('step 6 gains Restrict Service Accounts to the Trusted Network on a plan with service accounts, waiting on the group and the network', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.goalId === SERVICE_ACCOUNTS_TRUSTED_GOAL)!
  assert.ok(s, 'the demo has service accounts')
  assert.equal(s.plainTitle, 'Restrict Service Accounts to the Trusted Network')
  assert.deepEqual([...s.population.ids].sort(), [...f.mapping.serviceAccountUserIds].sort(), 'its population is the service accounts')
  assert.ok(s.blockedBy.includes(PREREQ_STEP_ID.serviceAccountsGroup), 'waits on the service-accounts group')
  const view = stepExportView(s, ctxFor(f, r))
  assert.ok(view.whatToDo.some((l) => /^Users → Include: Groups: .+\. Users → Exclude → Groups: /.test(l)), view.whatToDo.join(' | '))
  assert.ok(view.whatToDo.some((l) => /^Conditions → Locations → Include: Any location; Exclude: .+/.test(l)), 'the trusted network is the exclusion')
  assert.ok(!view.whatToDo.some((l) => /[0-9a-f]{8}-[0-9a-f]{4}-/.test(l)), 'every object is a name')
  const risk = (stepById[PREREQ_STEP_ID.serviceAccountsGroup] as unknown as { more: { risks: { text: string }[] } }).more.risks
  assert.ok(risk.some((x) => x.text.includes('see Restrict Service Accounts to the Trusted Network')), "step 6's risk names it")
  // GetIAMAI has no service accounts: no step.
  const g = fixture('getiamai')
  assert.equal(runFixture(g).steps.some((x) => x.goalId === SERVICE_ACCOUNTS_TRUSTED_GOAL), false)
})
