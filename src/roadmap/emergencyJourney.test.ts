import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { approvedPasskeyModels, emergencyMethodFinding, journeyGroupFindings, journeyPasskeyFindings, journeyRecoveryFindings, recoveryWaitingLine } from './emergencyJourney.ts'
import { buildContext, breakGlassReport } from '../validation/report.ts'
import { recoveryAccountBasis, recoveryCandidateReadings, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { readinessOf, stepContract } from '../ui/surfaces/stepContract.ts'
import { PASSKEY_DEFAULT_MODELS } from './passkeySettings.ts'
import { EXCLUSIONS_RECORD_KEY, exclusionsGroupIdToVerify } from '../mapping/safetyChoice.ts'

const HARDWARE = PASSKEY_DEFAULT_MODELS[2].aaguid
const UNAPPROVED = '11111111-2222-4333-8444-555555555555'
function tenant() {
  const f = structuredClone(fixture('demo-week2'))
  for (const id of f.mapping.breakGlassUserIds) f.snapshot.authMethods[id] = [{
    kind: 'fido2',
    id: `recovery-key-${id}`,
    displayName: 'Recovery key',
    aaGuid: HARDWARE,
    passkeyType: 'deviceBound',
    attestationLevel: 'attested',
    sourceVersion: 'v1.0',
  }]
  return f
}
const reportOf = (f: ReturnType<typeof tenant>) => breakGlassReport(buildContext({ snapshot: f.snapshot, state: f.mapping }))
function context(f: ReturnType<typeof tenant>) {
  return { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => f.snapshot.users.find(u => u.id === id)?.displayName || id, now: f.snapshot.asOf, signature: 'IT', operatorId: f.operatorId }
}

test('passkey topics stay compact while the approved-model disclosure remains complete', () => {
  const f = tenant()
  f.snapshot.authMethods[f.mapping.breakGlassUserIds[0]] = [{ kind: 'fido2', aaGuid: UNAPPROVED, passkeyType: 'deviceBound' }]
  const findings = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups)
  assert.equal(findings.length, 3)
  assert.deepEqual(findings.map(finding => finding.label), ['Passkey registration', 'Existing passkeys affected', 'Passkey protections'])
  const models = findings.find(t => t.key === 'protection')!
  const approved = approvedPasskeyModels(f.snapshot, f.mapping)
  for (const model of PASSKEY_DEFAULT_MODELS) {
    assert.equal(models.items?.filter(i => i.value.includes(model.aaguid)).length, 0)
    assert.equal(approved.filter(item => item.aaguid === model.aaguid).length, 1)
    assert.ok(approved.some(item => item.name === model.name))
  }
  assert.equal(approved.some(m => m.aaguid === UNAPPROVED), false)
  assert.notEqual(findings.find(t => t.key === 'recovery-methods')?.outcome, 'pass')
})

test('passkey topics use separate current and planned facts without a bare combined Disabled summary', () => {
  const f = tenant()
  const findings = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups)
  const protection = findings.find(item => item.key === 'protection')!
  assert.notEqual(protection.value, 'Disabled')
  assert.ok(protection.items?.some(item => item.factLabel === 'Current attestation'))
  assert.ok(protection.items?.every(item => item.subjectLabel !== item.factLabel))
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
  assert.equal(finding.items?.[0].subjectLabel, f.snapshot.users.find(user => user.id === b)!.userPrincipalName)
  assert.doesNotMatch(JSON.stringify(finding.items), new RegExp(context(f).nameOf(a)))
  assert.match(finding.items![0].value, /not read/)
  f.mapping.breakGlassUserIds = []
  assert.equal(emergencyMethodFinding(f.snapshot, f.mapping, f.groups).value, 'Select emergency accounts')
})

test('partial passkey settings remain explicit inside Passkey registration even when other settings pass', () => {
  const f = tenant()
  const policy = f.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, any>[] }
  const method = policy.authenticationMethodConfigurations.find(p => p.id === 'Fido2')!
  for (const target of method.includeTargets) delete target.allowedPasskeyProfiles
  const availability = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups).find(t => t.key === 'registration')!
  assert.equal(availability.outcome, 'unknown')
  assert.match(JSON.stringify(availability.items), /allowedPasskeyProfiles/)
})

test('a model-only mismatch remains visible as an actionable protection correction', () => {
  const f = tenant()
  const config = ((f.snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations as any[]).find(row => row.id === 'Fido2')
  const restrictions = config.passkeyProfiles?.[0]?.keyRestrictions ?? config.keyRestrictions
  restrictions.aaGuids = restrictions.aaGuids.filter((id: string) => id !== PASSKEY_DEFAULT_MODELS[0].aaguid)
  const protection = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups).find(row => row.key === 'protection')!
  assert.equal(protection.outcome, 'fail')
  assert.ok(protection.items?.some(item => item.outcome === 'fail' && /AAGUID|Authenticator/i.test(`${item.factLabel} ${item.value}`)))
})

test('an unsaved exclusions choice exposes only the actionable group-selection topic', () => {
  const f = noExclusionsAnswer(structuredClone(fixture('demo')))
  const run = runFixture(f)
  const step = run.steps.find(item => item.id === 's-prereq-exclusion-group')!
  const ready = readinessOf(step, stepContract(step, context(f)))
  assert.deepEqual([...ready.tiles, ...ready.satisfied].map(tile => tile.key), ['configuration:group-choice'])
  assert.doesNotMatch(JSON.stringify([...ready.tiles, ...ready.satisfied]), /Membership|Policy exclusions/)
})

test('a policy without readable excludeGroups is unknown rather than a confirmed missing exclusion', () => {
  const f = fixture('small')
  const groupId = exclusionsGroupIdToVerify(f.mapping)!
  const rows = f.snapshot.config.caPolicies.rows as Record<string, any>[]
  if (rows[0]) delete rows[0].conditions.users.excludeGroups
  const finding = journeyGroupFindings(reportOf(f), 'Emergency exclusions', true, f.snapshot, groupId, f.groups, f.mapping.breakGlassUserIds).find(row => row.key === 'group-policies')!
  const item = finding.items?.find(row => row.subjectId === rows[0]?.id && row.factLabel === 'Group exclusion')
  assert.equal(item?.outcome, 'unknown')
  assert.equal(item?.value, 'Could not verify')
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
  assert.deepEqual(findings.map(finding => finding.label), ['Configuration', 'Sign-in evidence', 'Verification results'])
  const identity = findings.find(t => t.key === 'recovery-configuration')?.items?.find(item => item.factLabel === 'Account identity')
  assert.equal(identity, undefined)
  assert.equal(findings.find(t => t.key === 'recovery-sign-ins')?.outcome, 'unknown')
  assert.ok(findings.find(t => t.key === 'recovery-sign-ins')!.items!.filter(item => item.factLabel === 'Matching event').every(item => /No qualifying event observed/.test(item.value)))
  assert.notEqual(findings.find(t => t.key === 'recovery-confirmation')?.outcome, 'pass')
})

test('final configuration sends credential work to Step 1, policy exclusions to Step 2 and profile settings to Step 3', () => {
  const f = tenant()
  const first = f.mapping.breakGlassUserIds[0]
  f.snapshot.authMethods[first] = []
  const findings = journeyRecoveryFindings(reportOf(f), f.snapshot, f.mapping, f.groups, [], f.snapshot.asOf)
  const configuration = findings.find(item => item.key === 'recovery-configuration')!
  const missing = configuration.items?.find(item => item.accountId === first && item.factLabel === 'Registered passkey')
  assert.equal(missing?.link?.href, '#/plan/s-prereq-break-glass')
  assert.ok(configuration.items?.filter(item => item.factLabel?.includes('policy') && item.link).every(item => item.link?.href === '#/plan/s-prereq-exclusion-group'))
  assert.ok((configuration.items?.filter(item => item.factLabel?.includes('policy') && item.link).length ?? 0) <= f.mapping.breakGlassUserIds.length)
  assert.ok(configuration.items?.filter(item => item.factLabel === 'Applicable profile').every(item => item.link?.href === '#/plan/s-prereq-passkey-settings'))
  assert.equal(configuration.items?.find(item => item.factLabel === 'Account identity')?.link, undefined)
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
  assert.ok(read([preparation, record]).find(t => t.key === 'recovery-sign-ins')!.items!.slice(0, 2).every(i => /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M/.test(i.value)))
  assert.notEqual(read([preparation, { ...record, outcome: 'failed' }]).find(t => t.key === 'recovery-confirmation')!.outcome, 'pass')
  const originalMethods = structuredClone(f.snapshot.authMethods[f.mapping.breakGlassUserIds[0]])
  f.snapshot.authMethods[f.mapping.breakGlassUserIds[0]] = [{ kind: 'fido2', aaGuid: UNAPPROVED, passkeyType: 'deviceBound' }]
  assert.equal(read([preparation, record]).find(t => t.key === 'recovery-configuration')!.outcome, 'fail')
  f.snapshot.authMethods[f.mapping.breakGlassUserIds[0]] = originalMethods
  f.snapshot.sources.signInEvidence = { ...f.snapshot.sources.signInEvidence, status: 'error', reason: 'Read denied' }
  f.snapshot.signInEvidence = {}
  assert.match(read([preparation, record]).find(t => t.key === 'recovery-sign-ins')!.items![0].label, /IAMAI could not read the verification evidence/)
  assert.match(read([preparation, record]).find(t => t.key === 'recovery-sign-ins')!.items![0].value, /Read denied/)
})

test('emergency-account finding rows use UPN identity without repeating display names', () => {
  const f = tenant()
  const expected = f.mapping.breakGlassUserIds.map(id => f.snapshot.users.find(row => row.id === id)!.userPrincipalName)
  assert.deepEqual([...new Set(emergencyMethodFinding(f.snapshot, f.mapping, f.groups).items?.map(item => item.subjectLabel))], expected)
  const recovery = journeyRecoveryFindings(reportOf(f), f.snapshot, f.mapping, f.groups, [], f.snapshot.asOf)
  assert.ok((recovery.find(item => item.key === 'recovery-sign-ins')?.items ?? []).every(item => !item.subjectLabel || expected.includes(item.subjectLabel)))
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
    assert.match(text, /scan again|Scan again|Scan to update the plan/)
    if (id !== 's-prereq-break-glass') assert.match(text, /#\/plan\/cleanup-drill/)
    assert.doesNotMatch(text, /\{[a-z]+\.[a-z]+\}/i)
  }
  const accounts = run.steps.find(s => s.id === 's-prereq-break-glass')!
  const text = stepBodyOf(accounts, ctx).artifacts.find(a => a.id === 'portal')!.text()
  assert.match(text, /Security info.*https:\/\/mysignins\.microsoft\.com\/security-info/)
  assert.doesNotMatch(text, /test the prepared|pre-change|#\/plan\/cleanup-drill/i)
  const group = run.steps.find(s => s.id === 's-prereq-exclusion-group')!
  const groupText = stepBodyOf(group, ctx).artifacts.find(a => a.id === 'portal')!.text()
  const numbers = [...groupText.matchAll(/^(\d+)\./gm)].map(m => Number(m[1]))
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1))
})

test('independent prerequisites and unsaved choices remain visible within the three group topics', () => {
  const f = tenant()
  const step = runFixture(f).steps.find(s => s.id === 's-prereq-exclusion-group')!
  step.unsavedInputs = ['Exclusions group']
  const ready = readinessOf(step, stepContract(step, context(f)), [{ kind: 'step', id: 's-prereq-break-glass', abnormal: false, label: 'Prerequisite', title: 'Emergency Access Accounts' }])
  assert.equal(ready.tiles.length + ready.satisfied.length, 3)
  assert.match(JSON.stringify(ready.tiles), /Emergency Access Accounts/)
  assert.match(JSON.stringify(ready.tiles), /Exclusions group/i)
})

test('policy exclusion rows state each policy mode without repeating the shared correction', () => {
  const f = tenant()
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]?.resolvedId as string
  const policies = journeyGroupFindings(reportOf(f), 'Emergency exclusions', true, f.snapshot, groupId, f.groups, f.mapping.breakGlassUserIds).find(t => t.key === 'group-policies')!
  assert.ok(policies.items?.length)
  assert.ok(policies.items?.filter(item => item.factLabel === 'Mode').every(item => /^(On|Report-only|Could not verify)$/.test(item.value)))
  assert.ok(policies.items?.filter(item => item.factLabel === 'Group exclusion').every(item => /^(Present|Missing)$/.test(item.value)))
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

test('Step 4 says what it is waiting on: a sign-in after the configuration start, and why the last one seen did not count', () => {
  const f = structuredClone(fixture('demo-week2'))
  const id = f.mapping.breakGlassUserIds[0]
  const candidate = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const start = '2026-09-18T18:37:17.142Z'
  const seen = { ...candidate, at: '2026-09-18T16:02:21Z', authenticationAt: '2026-09-18T16:02:21Z', resourceTenantId: f.snapshot.tenantId }
  const readings = recoveryCandidateReadings({ ...f.snapshot, signInEvidence: { ...f.snapshot.signInEvidence, [id]: { ...f.snapshot.signInEvidence[id]!, recoveryCandidates: [seen] } } }, id, '2026-09-18T19:00:00Z', start)
  const line = recoveryWaitingLine(start, readings, 'America/Chicago')
  assert.equal(line, 'Sign in with this account’s passkey after Sep 18, 2026, 1:37 PM CDT. Last sign-in seen Sep 18, 2026, 11:02 AM CDT did not count: The passkey authentication predates the current recovery configuration.')
  assert.doesNotMatch(line, /Follow Verify emergency sign-in/, 'the tile adds the action once')
  assert.equal(recoveryWaitingLine(start, [], 'UTC'), 'Sign in with this account’s passkey after Sep 18, 2026, 6:37 PM UTC.')
  assert.equal(recoveryWaitingLine(null, [], 'UTC'), 'Sign in with this account’s passkey once the configuration checks pass.')
})

test('with no display time zone set, Step 4 times read in the browser’s zone, not UTC', () => {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
  const start = '2026-09-18T16:37:21.751Z'
  assert.equal(recoveryWaitingLine(start, [], null), recoveryWaitingLine(start, [], browser))
  assert.equal(recoveryWaitingLine(start, [], 'Australia/Sydney'), 'Sign in with this account’s passkey after Sep 19, 2026, 2:37 AM GMT+10.')
})
