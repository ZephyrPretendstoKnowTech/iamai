// Every control is exact (owner, 2026-09-26): a correction points at exactly
// what the plan's policy has, and every difference, stricter or weaker, is
// either corrected or accepted with a reason. An exclusion the tenant has
// beyond the plan is asked to be removed; an emergency account excluded by name
// is the one exclusion left alone (Ongoing Checks and Cleanup removes it once the
// exclusions group covers the account).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { asPlansOwn } from './fixtures/asPlanned.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

type Row = Record<string, any>

test('an extra excluded group is asked to be removed; an emergency account excluded by name is left alone', () => {
  const f = structuredClone(fixture('demo'))
  const row = (f.snapshot.config.caPolicies.rows as Row[]).find((p) => p.displayName === 'Core - Grant - MFA for all users')!
  const emergency = f.mapping.breakGlassUserIds[0]
  assert.ok((row.conditions.users.excludeUsers as string[]).includes(emergency), 'the premise: the policy excludes an emergency account by name')
  const extra = 'c0100000-0000-4000-8000-00000000beef'
  row.conditions.users.excludeGroups = [...(row.conditions.users.excludeGroups ?? []), extra]
  f.groups.set(extra, { memberIds: [], memberCount: 0, sampled: false, displayName: 'Old VIP exclusions' } as never)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  const op = (step.action.resolution?.policies ?? [])[0]
  assert.equal(op?.mode, 'update')
  assert.deepEqual(op?.removes?.ids, [extra], 'the change says it removes the extra exclusion')
  assert.ok(((op?.body as Row).conditions.users.excludeUsers as string[]).includes(emergency), 'and keeps the emergency account')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const lines = stepBodyOf(step, ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'correct')?.steps ?? []
  assert.ok(lines.some((l) => /Users → Exclude\*\*, remove the group \*\*Old VIP exclusions\*\*/.test(l)), lines.join(' | '))
  assert.equal(lines.some((l) => /remove the account/.test(l)), false, 'no emergency account is asked to be removed')
})

test('a correction that loosens the policy says it is stricter, and that an acceptance keeps it', () => {
  // Week two's admins policy requires the built-in phishing-resistant strength; the baseline's is Modern MFA + TAP.
  // Under the baseline's name it is the plan's own, which 4.3 corrects (T4-PM: one of the tenant's own it builds beside).
  const f = asPlansOwn(fixture('demo-week2'), 's-goal-admins-phishing-resistant')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.ok(step.tracking?.members?.[0]?.differences?.some((d) => d.dimension === 'grantControls' && d.direction === 'stricter'), 'the premise: a stronger grant')
  assert.ok(step.state.observation?.unwritten.includes('grantControls'), 'is corrected or accepted, never accepted silently')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const grant = (stepBodyOf(step, ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'correct')?.steps ?? []).find((l) => l.startsWith('Under **Grant**'))
  assert.match(grant ?? '', /Yours is stricter than the baseline here: to keep it, accept the difference instead\.$/)
})
