// Overnight review item 18 (owner-approved 2026-09-19): three small wording
// items on Establish Emergency Access.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'
import { emergencyMethodFinding } from './emergencyJourney.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { emergencyAccountTasksOf } from '../ui/surfaces/emergencyAccountTasks.ts'

function run() {
  const f = structuredClone(fixture('demo-week2'))
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: id => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  return { f, r, ctx }
}

test('Step 1 names the sign-in domain check plainly', () => {
  const { r, ctx } = run()
  const accounts = emergencyAccountTasksOf(r.steps.find(s => s.id === 's-prereq-break-glass')!, ctx).accounts
  const completed = accounts.flatMap(account => account.completed)
  assert.ok(completed.includes('Signs in with the tenant’s onmicrosoft.com address'), completed.join(' | '))
  assert.equal(completed.some(line => /Initial onmicrosoft/.test(line)), false)
})

test('an account the Passkey method excludes is told what that means and what to change', () => {
  const { f } = run()
  const id = f.mapping.breakGlassUserIds[0]
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
  const row = f.snapshot.config.authMethodsPolicy.rows[0] as Record<string, any>
  const fido = row.fido2Configuration ?? row.authenticationMethodConfigurations.find((c: Record<string, unknown>) => String(c.id).toLowerCase() === 'fido2')
  // The common mistake: the Conditional Access exclusions group added to the method's own exclusions.
  fido.excludeTargets = [{ id: groupId, targetType: 'group' }]
  const finding = emergencyMethodFinding(f.snapshot, f.mapping, f.groups)
  const text = JSON.stringify(finding.items?.filter(item => item.accountId === id))
  assert.match(text, /The Passkey \(FIDO2\) authentication method excludes this account, so it cannot sign in with a passkey/)
  assert.match(text, /Exclude list/)
  assert.doesNotMatch(text, /must not exclude it from the authentication method/)
})

test('Emergency Access tile labels use sentence case, as the other Plan tile labels do', () => {
  const { r } = run()
  const labels = [
    ...['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings'].flatMap(id => r.steps.find(s => s.id === id)?.configurationFindings?.map(finding => finding.label) ?? []),
    ...(r.schedule.cleanup?.recoveryFindings ?? []).map(finding => finding.label),
  ]
  assert.ok(labels.length >= 8, labels.join(', '))
  for (const label of labels) assert.match(label, /^[A-Z][a-z-]*(?: [a-z-]+)*$/, `sentence case: ${label}`)
})
