// A correction to a tenant policy that is already On takes effect at the next
// sign-in, with no report-only week (owner, 2026-09-28; the pre-launch walk found
// 7.5 Require Token Protection on Windows adding five resources to an enforced
// policy, with nothing saying so). The card, the Correct task and the script say
// it; a correction to a policy in report-only or off says nothing of the kind.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { policySubjectsOf } from './policyTasks.ts'
import { shared } from '../../content/content.ts'

const ON = (shared as unknown as { procedure: { policyOn: string } }).procedure.policyOn

test('the line is the owner\'s words', () => {
  assert.equal(ON, 'This policy is On: a saved change applies at the next sign-in.')
})

test('a correction says the policy is On exactly when the tenant\'s policy is On: on its card, its task and its script', () => {
  let on = 0
  let notOn = 0
  // The same tenants with their On policies in Report-only: since 4.3 builds beside the
  // tenant's own admin policy (T4-PM), the samples hold no correction to a policy that is
  // not On, and these variants give the other half its cases.
  const asReportOnly = (name: FixtureName) => {
    const f = structuredClone(fixture(name))
    for (const r of (f.snapshot.config.caPolicies?.rows ?? []) as { state?: string }[]) if (r.state === 'enabled') r.state = 'enabledForReportingButNotEnforced'
    return f
  }
  // The samples' On policies exactly the baseline's under the tenant's names are their
  // steps' own and in place (owner option, 2026-10-05: Align Policy Names suggests the
  // name), so nothing is corrected on them: this variant's legacy block carries the
  // baseline's name and blocks only Exchange ActiveSync, a real correction to a policy On.
  const ownDrifted = (state: string) => {
    const f = structuredClone(fixture('demo-week2'))
    const step = runFixture(f).steps.find((s) => s.id === 's-goal-block-legacy-auth')!
    const row = ((f.snapshot.config.caPolicies?.rows ?? []) as { displayName?: string; conditions?: { clientAppTypes?: string[] } }[]).find((r) => r.displayName === 'Core - Block - Legacy authentication')!
    row.displayName = step.createName
    row.conditions = { ...row.conditions, clientAppTypes: ['exchangeActiveSync'] }
    ;(row as { state?: string }).state = state
    return f
  }
  const tenants = [...(['demo', 'demo-week2', 'mid', 'large', 'midflight', 'messy'] as FixtureName[]).map((n) => [n, fixture(n)] as const), ...(['demo-week2', 'mid', 'large', 'midflight', 'messy'] as FixtureName[]).map((n) => [`${n} (report-only)`, asReportOnly(n)] as const), ['demo-week2 (its own legacy block drifted)', ownDrifted('enabled')] as const, ['demo-week2 (its own legacy block drifted, report-only)', ownDrifted('enabledForReportingButNotEnforced')] as const]
  for (const [name, f] of tenants) {
    const run = runFixture(f)
    const rows = (f.snapshot.config.caPolicies?.rows ?? []) as { displayName?: string; state?: string }[]
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
    for (const step of run.steps) {
      const body = stepBodyOf(step, ctx)
      const correct = body.emergencyAccountTasks?.tasks.find((t) => t.id === 'correct')
      if (!correct) continue
      const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks).filter((c) => c.key.startsWith('correct:'))
      const ps = body.artifacts.find((a) => a.id === 'ps')?.text() ?? ''
      // No step hands over a rename (owner option, 2026-10-05): Align Policy Names suggests names.
      assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.renamesOnly === true), `${name}/${step.id}: a step renames its policy`)
      for (const card of cards) {
        const state = rows.find((r) => r.displayName === card.upn)?.state
        const where = `${name}/${step.id}/${card.upn}`
        const says = String(card.detail ?? '').split('\n').includes(ON)
        if (state === 'enabled') {
          on++
          assert.ok(says, `${where}: a correction to a policy that is On does not say so: ${card.detail}`)
          assert.ok(correct.steps.includes(ON), `${where}: the Correct task does not say the policy is On`)
          if (ps !== '') assert.ok(ps.split('\n').slice(0, 3).includes(`# ${ON}`), `${where}: the script does not say it first: ${ps.slice(0, 160)}`)
        } else if (state !== undefined) {
          notOn++
          assert.equal(says, false, `${where}: a correction to a policy that is ${state} says it is On`)
        }
      }
      if (!cards.some((c) => rows.find((r) => r.displayName === c.upn)?.state === 'enabled')) {
        assert.equal(correct.steps.includes(ON), false, `${name}/${step.id}: no corrected policy is On, and the task says one is`)
        assert.doesNotMatch(ps, new RegExp(`^# ${ON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), `${name}/${step.id}: the script says a policy is On`)
      }
    }
  }
  assert.ok(on > 0, 'the premise: a correction to a policy that is On')
  assert.ok(notOn > 0, 'the premise: a correction to a policy in report-only or off')
})
