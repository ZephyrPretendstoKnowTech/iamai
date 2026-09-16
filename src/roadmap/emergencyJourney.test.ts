import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { approvedPasskeyModels, emergencyMethodFinding, journeyGroupFindings, journeyPasskeyFindings, journeyRecoveryFindings } from './emergencyJourney.ts'
import { buildContext, breakGlassReport } from '../validation/report.ts'
import { recoveryAccountBasis, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { readinessOf, stepContract } from '../ui/surfaces/stepContract.ts'
import { PASSKEY_DEFAULT_MODELS } from './passkeySettings.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'

const HARDWARE = PASSKEY_DEFAULT_MODELS[2].aaguid
const UNAPPROVED = '11111111-2222-4333-8444-555555555555'
function tenant() {
  const f = structuredClone(fixture('demo-week2'))
  for (const id of f.mapping.breakGlassUserIds) f.snapshot.authMethods[id] = [{ kind: 'fido2', displayName: 'Recovery key', aaGuid: HARDWARE, passkeyType: 'deviceBound' }]
  return f
}
const reportOf = (f: ReturnType<typeof tenant>) => breakGlassReport(buildContext({ snapshot: f.snapshot, state: f.mapping }))
function context(f: ReturnType<typeof tenant>) {
  return { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => f.snapshot.users.find(u => u.id === id)?.displayName || id, now: f.snapshot.asOf, signature: 'IT', operatorId: f.operatorId }
}

test('passkey topics keep each approved AAGUID in one named row and never approve a registered unknown model', () => {
  const f = tenant()
  f.snapshot.authMethods[f.mapping.breakGlassUserIds[0]] = [{ kind: 'fido2', aaGuid: UNAPPROVED, passkeyType: 'deviceBound' }]
  const findings = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups)
  assert.equal(findings.length, 4)
  const models = findings.find(t => t.key === 'models')!
  for (const model of PASSKEY_DEFAULT_MODELS) {
    assert.equal(models.items?.filter(i => i.value.includes(model.aaguid)).length, 1)
    assert.ok(models.items?.some(i => i.label === model.name))
  }
  assert.equal(approvedPasskeyModels(f.snapshot, f.mapping).some(m => m.aaguid === UNAPPROVED), false)
  assert.notEqual(findings.find(t => t.key === 'recovery-methods')?.outcome, 'pass')
})

test('selected accounts drive method findings; unread methods do not become missing keys or passes', () => {
  const f = tenant()
  const [a, b] = f.mapping.breakGlassUserIds
  assert.equal(emergencyMethodFinding(f.snapshot, f.mapping, f.groups).outcome, 'pass')
  f.mapping.breakGlassUserIds = [b]
  f.snapshot.authMethods[b] = 'unknown'
  const finding = emergencyMethodFinding(f.snapshot, f.mapping, f.groups)
  assert.equal(finding.outcome, 'unknown')
  assert.equal(finding.items?.length, 1)
  assert.equal(finding.items?.[0].label, `${context(f).nameOf(b)} — ${f.snapshot.users.find(user => user.id === b)!.userPrincipalName}`)
  assert.doesNotMatch(JSON.stringify(finding.items), new RegExp(context(f).nameOf(a)))
  assert.match(finding.items![0].value, /not read/)
  f.mapping.breakGlassUserIds = []
  assert.equal(emergencyMethodFinding(f.snapshot, f.mapping, f.groups).value, 'Select emergency accounts')
})

test('partial passkey settings remain explicit inside Availability even when other settings pass', () => {
  const f = tenant()
  const policy = f.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, any>[] }
  const method = policy.authenticationMethodConfigurations.find(p => p.id === 'Fido2')!
  for (const target of method.includeTargets) delete target.allowedPasskeyProfiles
  const availability = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups).find(t => t.key === 'recovery-ready')!
  assert.equal(availability.outcome, 'unknown')
  assert.match(JSON.stringify(availability.items), /allowedPasskeyProfiles/)
})

test('a successful generic sign-in cannot satisfy observed passkey evidence or a recorded recovery test', () => {
  const f = tenant()
  const id = f.mapping.breakGlassUserIds[0]
  const other = f.mapping.breakGlassUserIds[1]
  f.snapshot.signInEvidence = {
    [id]: { signInCount: 1, lastSignIn: f.snapshot.asOf, lastMfaSuccess: null, proofs: [], recoveryCandidates: [] },
    [other]: { signInCount: 1, lastSignIn: f.snapshot.asOf, lastMfaSuccess: null, proofs: [{ at: f.snapshot.asOf, cls: 'passkey', os: null, method: 'FIDO2 security key' }], recoveryCandidates: [] },
  }
  const findings = journeyRecoveryFindings(reportOf(f), f.snapshot, f.mapping, f.groups, [], f.snapshot.asOf)
  assert.deepEqual(findings.map(finding => finding.label), ['Configuration', 'Successful Sign-ins', 'Recovery Confirmation', 'Verification Status'])
  assert.match(JSON.stringify(findings.find(t => t.key === 'recovery-configuration')?.items), /Account Preparation.*Policy Exclusions.*Emergency Recovery Methods/)
  assert.equal(findings.find(t => t.key === 'recovery-sign-ins')?.outcome, 'unknown')
  assert.match(findings.find(t => t.key === 'recovery-sign-ins')!.items![1].value, /No qualifying interactive administrative passkey sign-in/)
  assert.notEqual(findings.find(t => t.key === 'recovery-confirmation')?.outcome, 'pass')
})

test('a failed read asks for evidence, and a later failure or relevant key change reopens a saved drill', () => {
  const f = tenant()
  const now = f.snapshot.asOf
  const date = now.slice(0, 10)
  const accountBasis = recoveryAccountBasis(f.snapshot, f.mapping.breakGlassUserIds, f.mapping, f.groups)
  const configurationObservedAt = new Date(Math.min(...f.mapping.breakGlassUserIds.map(id => Date.parse(f.snapshot.signInEvidence[id]!.recoveryCandidates![0].at))) - 3_600_000).toISOString()
  const preparation: CleanupCheckpoint = { cleanup: 'drill', date: configurationObservedAt, at: configurationObservedAt, accountIds: f.mapping.breakGlassUserIds, workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: f.snapshot.tenantId, configurationObservedAt, accountBasis }
  const record: CleanupCheckpoint = { cleanup: 'drill', date, at: now, outcome: 'passed', purpose: 'final', accountIds: f.mapping.breakGlassUserIds, accountBasis, recoveryEvidence: Object.fromEntries(f.mapping.breakGlassUserIds.map(id => { const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]; return [id, { schema: 1, purpose: 'final', tenantId: f.snapshot.tenantId, accountId: id, eventId: event.eventId, eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)', provenance: 'observed-sign-in', recoveryConfirmed: true, credentialConfirmed: true, configurationObservedAt }] })) }
  const read = (records: CleanupCheckpoint[]) => journeyRecoveryFindings(reportOf(f), f.snapshot, f.mapping, f.groups, records, now)
  assert.ok(read([preparation, record]).find(t => t.key === 'recovery-confirmation')!.items!.slice(0, 2).every(i => i.value.startsWith('Passed')))
  assert.ok(read([preparation, { ...record, outcome: 'failed' }]).find(t => t.key === 'recovery-confirmation')!.items!.slice(0, 2).every(i => /failed/.test(i.value)))
  f.snapshot.authMethods[f.mapping.breakGlassUserIds[0]] = [{ kind: 'fido2', aaGuid: UNAPPROVED, passkeyType: 'deviceBound' }]
  assert.doesNotMatch(read([preparation, record]).find(t => t.key === 'recovery-confirmation')!.items![0].value, /^Passed/)
  f.snapshot.sources.signInEvidence = { ...f.snapshot.sources.signInEvidence, status: 'error', reason: 'Read denied' }
  f.snapshot.signInEvidence = {}
  assert.match(read([preparation, record]).find(t => t.key === 'recovery-sign-ins')!.items![0].value, /could not be fully read: Read denied/)
})

test('emergency-account finding rows identify both display name and UPN', () => {
  const f = tenant()
  const expected = f.mapping.breakGlassUserIds.map(id => { const user = f.snapshot.users.find(row => row.id === id)!; return `${user.displayName} — ${user.userPrincipalName}` })
  assert.deepEqual(emergencyMethodFinding(f.snapshot, f.mapping, f.groups).items?.map(item => item.label), expected)
  const recovery = journeyRecoveryFindings(reportOf(f), f.snapshot, f.mapping, f.groups, [], f.snapshot.asOf)
  assert.deepEqual(recovery.find(item => item.key === 'recovery-sign-ins')?.items?.map(item => item.label), expected)
})

test('all three setup steps offer complete copyable Entra instructions while unresolved', () => {
  const f = structuredClone(fixture('demo'))
  const run = runFixture(f)
  const ctx = context(f)
  for (const id of ['s-prereq-passkey-settings', 's-prereq-break-glass', 's-prereq-exclusion-group']) {
    const step = run.steps.find(s => s.id === id)!
    const body = stepBodyOf(step, ctx)
    const portal = body.artifacts.find(a => a.id === 'portal')
    assert.ok(portal, id + ' has no Entra channel')
    const text = portal.text()
    assert.match(text, /Entra/)
    assert.match(text, /scan again|Scan again/)
    assert.match(text, /#\/plan\/cleanup-drill/)
    assert.doesNotMatch(text, /\{[a-z]+\.[a-z]+\}/i)
  }
  const accounts = run.steps.find(s => s.id === 's-prereq-break-glass')!
  const text = stepBodyOf(accounts, ctx).artifacts.find(a => a.id === 'portal')!.text()
  assert.ok(text.indexOf('approved recovery choices') < text.indexOf('Add sign-in method'))
  const group = run.steps.find(s => s.id === 's-prereq-exclusion-group')!
  const groupText = stepBodyOf(group, ctx).artifacts.find(a => a.id === 'portal')!.text()
  const numbers = [...groupText.matchAll(/^(\d+)\./gm)].map(m => Number(m[1]))
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1))
})

test('independent prerequisites and unsaved choices remain visible within four topics', () => {
  const f = tenant()
  const step = runFixture(f).steps.find(s => s.id === 's-prereq-exclusion-group')!
  step.unsavedInputs = ['Exclusions group']
  const ready = readinessOf(step, stepContract(step, context(f)), [{ kind: 'step', id: 's-prereq-break-glass', abnormal: false, label: 'Prerequisite', title: 'Emergency Access Accounts' }])
  assert.equal(ready.tiles.length + ready.satisfied.length, 4)
  assert.match(JSON.stringify(ready.tiles), /Emergency Access Accounts/)
  assert.match(JSON.stringify(ready.tiles), /Exclusions group/i)
})

test('policy exclusion rows state each policy mode without repeating the shared correction', () => {
  const f = tenant()
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]?.resolvedId as string
  const policies = journeyGroupFindings(reportOf(f), 'Emergency exclusions', true, f.snapshot, groupId).find(t => t.key === 'group-policies')!
  assert.ok(policies.items?.length)
  assert.ok(policies.items?.every(item => /^(On|Report-only|Mode not read)( · Group already excluded)?$/.test(item.value)))
  assert.doesNotMatch(JSON.stringify(policies.items), /Add the group exclusion/)
})

test('emergency exclusions stay on hold until emergency accounts are selected', () => {
  const f = structuredClone(fixture('demo'))
  f.mapping.breakGlassUserIds = []
  const result = runFixture(f)
  const exclusions = result.steps.find(step => step.id === 's-prereq-exclusion-group')!
  assert.equal(exclusions.status, 'blocked')
  assert.ok(exclusions.blockers.some(blocker => blocker.kind === 'step' && blocker.stepId === 's-prereq-break-glass'))
  assert.ok(result.schedule.cleanup?.rows.some(row => row.kind === 'drill'), 'Verify Emergency Access remains present as the fourth journey row')
})
