// Disable or Confirm Dormant Accounts (owner audit, 2026-09-24): with nobody
// dormant, the procedure said "Still needed: select it under Accounts you are
// keeping, then select Done." and no such picker is drawn. The keep choice
// points at the picker only where the picker is drawn.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { DORMANT_STEP_ID, sectionThreeTasksOf } from './sectionThreeTasks.ts'
import type { StepVarContext } from './stepVars.ts'

test('the keep choice names the Accounts you are keeping picker only where the step draws it', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DORMANT_STEP_ID)
  assert.ok(step, 'the premise: the demo plan carries the step')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const text = (s: typeof step): string => sectionThreeTasksOf(s, ctx)!.tasks.flatMap((t) => t.steps).join('\n')
  assert.ok((step.dormantChoices ?? []).length > 0, 'the premise: somebody is dormant')
  assert.match(text(step), /Still needed: select it under \*\*Accounts you are keeping\*\*/)
  const none = text({ ...step, dormantChoices: [] })
  assert.doesNotMatch(none, /Accounts you are keeping/)
  assert.match(none, /^- Still needed: leave it enabled\.$/m)
})

// v1.1 T1-3: an account synced from on-premises Active Directory is disabled in
// Active Directory; the next sync undoes a change made in Entra. Its line says
// synced, the Active Directory choice follows the Entra one, and a tenant with
// no synced dormant account reads the cloud procedure alone.
test('a dormant account synced from Active Directory is named synced, and is disabled in Active Directory', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DORMANT_STEP_ID)
  assert.ok(step, 'the premise: the demo plan carries the step')
  const [first, second] = step.dormantChoices ?? []
  assert.ok(first && second, 'the premise: two accounts are dormant')
  const ctxOf = (snapshot: typeof f.snapshot): StepVarContext => ({ snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })
  const text = (snapshot: typeof f.snapshot): string => sectionThreeTasksOf(step, ctxOf(snapshot))!.tasks.flatMap((t) => t.steps).join('\n')

  const cloud = f.snapshot.users.map((u) => ({ ...u, onPremisesSyncEnabled: false }))
  const cloudText = text({ ...f.snapshot, users: cloud })
  assert.doesNotMatch(cloudText, /Active Directory/)
  assert.match(cloudText, /^- Not needed: as at least a User Administrator, open \[Microsoft Entra admin center\]/m)

  const hybrid = cloud.map((u) => (u.id === first.id ? { ...u, onPremisesSyncEnabled: true } : u))
  const lines = text({ ...f.snapshot, users: hybrid }).split('\n')
  const accountLine = (name: string): string => lines.find((l) => l.startsWith('- ') && l.includes(name))!
  assert.match(accountLine(first.name), / · synced from Active Directory$/)
  assert.doesNotMatch(accountLine(second.name), /synced/)
  const entra = lines.findIndex((l) => l.startsWith('- Not needed: as at least a User Administrator'))
  assert.ok(entra >= 0, 'the Entra procedure stays for cloud accounts')
  assert.match(lines[entra + 1], /^- Not needed and synced from Active Directory: disable it in Active Directory instead, not in Entra\. In \*\*Active Directory Users and Computers\*\*, right-click the account and select \*\*Disable Account\*\*\..*undone by that sync\.$/)
  assert.match(lines[entra + 2], /^- Still needed: select it under \*\*Accounts you are keeping\*\*/)
})
