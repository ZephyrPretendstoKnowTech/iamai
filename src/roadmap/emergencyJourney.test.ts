import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { approvedPasskeyModels, emergencyMethodFinding, journeyAccountFindings, journeyGroupFindings, journeyPasskeyFindings, journeyRecoveryFindings, recoveryWaitingLine } from './emergencyJourney.ts'
import { emergencyTierOf } from '../validation/emergencyTiers.ts'
import { buildContext, breakGlassReport } from '../validation/report.ts'
import { cleanupRecord, reconcileAutomaticRecovery, recoveryAccountBasis, recoveryCandidateReadings, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import type { RecoveryDirectoryAudit } from '../graph/collect/types.ts'
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
  // Verification results is gone (owner, 2026-09-23): the Sign-in evidence verdict was its value.
  assert.deepEqual(findings.map(finding => finding.label), ['Configuration', 'Sign-in evidence'])
  const identity = findings.find(t => t.key === 'recovery-configuration')?.items?.find(item => item.factLabel === 'Account identity')
  assert.equal(identity, undefined)
  assert.equal(findings.find(t => t.key === 'recovery-sign-ins')?.outcome, 'unknown')
  assert.ok(findings.find(t => t.key === 'recovery-sign-ins')!.items!.filter(item => item.factLabel === 'Matching event').every(item => /No qualifying event observed/.test(item.value)))
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
  assert.notEqual(read([preparation, { ...record, outcome: 'failed' }]).find(t => t.key === 'recovery-sign-ins')!.outcome, 'pass')
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

// "Sign in with this account’s passkey after {date}" asked for a sign-in at a
// time that had already passed (owner, 2026-09-23). The line asks for a sign-in
// since the most recent change and lists the two dates that show whether one has
// happened: the same two dates the old sentence named.
test('Step 4 says what it is waiting on: a sign-in since the most recent change, with the last change and the last sign-in', () => {
  const f = structuredClone(fixture('demo-week2'))
  const id = f.mapping.breakGlassUserIds[0]
  const candidate = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const start = '2026-09-18T18:37:17.142Z'
  const changed = { at: start, changeObserved: true }
  const readingsOf = (...seen: typeof candidate[]) => recoveryCandidateReadings({ ...f.snapshot, signInEvidence: { ...f.snapshot.signInEvidence, [id]: { ...f.snapshot.signInEvidence[id]!, recoveryCandidates: seen } } }, id, '2026-09-18T19:00:00Z', start)
  const before = { ...candidate, at: '2026-09-18T16:02:21Z', authenticationAt: '2026-09-18T16:02:21Z', resourceTenantId: f.snapshot.tenantId }
  const line = recoveryWaitingLine(changed, readingsOf(before), null, 'America/Chicago')
  assert.deepEqual(line.split('\n'), [
    'Sign in with this account’s passkey since the most recent change.',
    'Last change: Sep 18, 2026, 1:37 PM CDT',
    'Last sign-in: Sep 18, 2026, 11:02 AM CDT',
  ])
  // The dates show why that sign-in did not count; the line does not say it again.
  assert.doesNotMatch(line, /did not count|predates| after /)
  assert.doesNotMatch(line, /Follow Verify emergency sign-in/, 'the tile adds the action once')
  assert.equal(recoveryWaitingLine(changed, [], null, 'UTC'), 'Sign in with this account’s passkey since the most recent change.\nLast change: Sep 18, 2026, 6:37 PM UTC\nLast sign-in: none seen')
  // A start IAMAI did not see change (where the audit log began) is not called a change.
  assert.equal(recoveryWaitingLine({ at: start, changeObserved: false }, [], null, 'UTC'), 'Sign in with this account’s passkey since the most recent change.\nNo change seen since: Sep 18, 2026, 6:37 PM UTC\nLast sign-in: none seen')
  assert.equal(recoveryWaitingLine(null, [], null, 'UTC'), 'Sign in with this account’s passkey once the configuration checks pass.')
  // A sign-in after the change that still did not count is one the dates cannot
  // explain, so its reason stays, on a line of its own.
  const later = { ...before, at: '2026-09-18T18:50:00Z', authenticationAt: '2026-09-18T18:50:00Z', success: false }
  assert.deepEqual(recoveryWaitingLine(changed, readingsOf(before, later), null, 'America/Chicago').split('\n'), [
    'Sign in with this account’s passkey since the most recent change.',
    'Last change: Sep 18, 2026, 1:37 PM CDT',
    'Last sign-in: Sep 18, 2026, 1:50 PM CDT',
    'The sign-in did not succeed.',
  ])
})

test('with no display time zone set, Step 4 times read in the browser’s zone, not UTC', () => {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
  const start = { at: '2026-09-18T16:37:21.751Z', changeObserved: true }
  assert.equal(recoveryWaitingLine(start, [], null, null), recoveryWaitingLine(start, [], null, browser))
  assert.match(recoveryWaitingLine(start, [], null, 'Australia/Sydney'), /^Last change: Sep 19, 2026, 2:37 AM GMT\+10$/m)
})

// A mature tenant: emergency access set up long ago, nothing relevant in the
// directory audit log IAMAI read, and no emergency sign-in in it either. The
// baseline then starts where that log starts, and stays there scan after scan.
// That is not a change: "Last change: {date}" named a change on a day nothing
// changed. The line says no change was seen since, and keeps "Last change" for a
// change IAMAI read.
test('Step 4 says "Last change" only for a change IAMAI read in the audit log', () => {
  const f = structuredClone(fixture('demo-week2'))
  f.mapping.displayTimeZone = 'UTC'
  const ids = f.mapping.breakGlassUserIds
  const first = f.snapshot.asOf
  const plus = (hours: number) => new Date(Date.parse(first) + hours * 3_600_000).toISOString()
  const time = (iso: string) => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' }).format(new Date(iso))
  for (const id of ids) f.snapshot.signInEvidence[id] = { ...f.snapshot.signInEvidence[id]!, lastSignIn: null, recoveryCandidates: [] }
  let checkpoints: unknown[] = []
  const others = (f.checkpoints ?? []).filter(record => (record as CleanupCheckpoint).cleanup !== 'drill')
  // Each account's Sign-in evidence line, as Step 4 draws it on this scan.
  const linesOf = (records: unknown[]) => Object.fromEntries(runFixture({ ...f, checkpoints: [...others, ...records] }).schedule.cleanup!.recoveryFindings!.find(finding => finding.key === 'recovery-sign-ins')!.items!.map(item => [item.accountId!, item.value.split('\n')]))
  const scan = (at: string, audits: RecoveryDirectoryAudit[]) => {
    const window = { from: new Date(Date.parse(at) - 30 * 86_400_000).toISOString(), to: at }
    f.snapshot.asOf = at
    f.snapshot.recoveryAuditSource = { status: 'ok', reason: null, coveredWindow: window, asOf: at }
    f.snapshot.sources.signInEvidence = { status: 'ok', reason: null, coveredWindow: window, asOf: at }
    f.snapshot.recoveryDirectoryAudits = audits
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    return linesOf(checkpoints)
  }
  const logStart = time(plus(-30 * 24))
  const scanned = scan(first, [])
  assert.deepEqual(Object.keys(scanned).sort(), [...ids].sort())
  for (const lines of Object.values(scanned)) assert.deepEqual(lines.slice(0, 2), ['Sign in with this account’s passkey since the most recent change.', `No change seen since: ${logStart}`])
  // A day on, still nothing: the start stays where the log began, and is still not called a change.
  for (const lines of Object.values(scan(plus(24), []))) {
    assert.equal(lines[1], `No change seen since: ${logStart}`)
    assert.doesNotMatch(lines.join('\n'), /Last change/)
  }
  // A change IAMAI read is the last change, for the account it touched only.
  const changed = scan(plus(48), [{ id: 'audit-account-change', at: plus(47), activity: 'Update user', category: 'UserManagement', result: 'success', targets: [{ id: ids[0], type: 'User' }] }])
  assert.equal(changed[ids[0]][1], `Last change: ${time(plus(47))}`)
  assert.equal(changed[ids[1]][1], `No change seen since: ${logStart}`)
  // A baseline recorded before IAMAI kept that fact is a change only where the
  // audit log IAMAI read has one at that time.
  const legacy = cleanupRecord(checkpoints).records!.map(record => { const { configurationChangeObserved: _kept, ...rest } = record; return rest })
  const read = linesOf(legacy)
  assert.equal(read[ids[0]][1], `Last change: ${time(plus(47))}`)
  assert.equal(read[ids[1]][1], `No change seen since: ${logStart}`)
})

// Emergency access is the plan's one large gate (owner, 2026-09-20), so a
// contradiction on its own card costs more here than anywhere else. `tenant()`
// gives both accounts the same single hardware key, which is exactly what
// bg.methodDiversity warns about — a warning, in the hardening tier, that the
// step is meant to finish over. The card said "Recovery method correction
// required" while the step read Completed: the one gate disagreeing with its own
// evidence. The tier decides the word now, in the vocabulary the step already
// uses for that tier.
test('a hardening warning reads as hardening on the card, and only a minimum check is a correction', () => {
  const f = tenant()
  const both = journeyAccountFindings(reportOf(f), f.snapshot, f.mapping)
  const methods = both.find((x) => x.key === 'recovery-methods')!
  const results = reportOf(f).targets.flatMap((t) => t.results)
  const diversity = results.find((r) => r.id === 'bg.methodDiversity')!
  assert.notEqual(diversity.outcome, 'pass', 'the premise: both accounts rely on one method type')
  assert.equal(emergencyTierOf(diversity, f.mapping.breakGlassUserIds.length), 'hardening', 'the premise: it is hardening, not minimum')
  assert.equal(methods.value, 'Minimum met · hardening open')
  assert.equal(/correction/i.test(methods.value), false, 'a warning the step finishes over is not a correction')
  // The step does finish over it, which is why the card must not say otherwise.
  const run = runFixture(f)
  assert.equal(run.steps.find((s) => s.id === 's-prereq-break-glass')?.status, 'done')

  // A minimum check is still a correction, and the step does not finish.
  const none = structuredClone(f)
  none.snapshot.authMethods[none.mapping.breakGlassUserIds[0]] = []
  const broken = journeyAccountFindings(reportOf(none), none.snapshot, none.mapping).find((x) => x.key === 'recovery-methods')!
  assert.equal(/correction/i.test(broken.value), true, broken.value)
  assert.notEqual(runFixture(none).steps.find((s) => s.id === 's-prereq-break-glass')?.status, 'done')
})

// The one gate the whole plan stands behind read "Authenticator model:
// a25342c0-3cdc-4414-8e46-f4807fca511c" on the shipped demo, twice, while that
// AAGUID is the pinned list's own "YubiKey 5 Series with NFC" and the
// passkey-settings step a few rows away was already resolving names from it.
test(`an emergency account's passkey is named by its model, never by its identifier alone`, () => {
  const f = fixture('demo-week2')
  const finding = emergencyMethodFinding(f.snapshot, f.mapping, f.groups)
  const models = (finding.items ?? []).filter((i) => i.label === 'Authenticator model')
  assert.ok(models.length > 0, 'the premise: this tenant has a registered passkey with an AAGUID')
  let named = 0
  for (const item of models) {
    const value = String(item.value)
    if (value === 'Could not verify') continue
    named += 1
    assert.doesNotMatch(value, /^[0-9a-f-]+$/i, `the model reads as its identifier alone: ${value}`)
    const known = PASSKEY_DEFAULT_MODELS.find((m) => value.toLowerCase().includes(m.aaguid))
    assert.ok(known, `an AAGUID outside the approved list: ${value}`)
    // The name first, and the identifier kept so it can still be checked by hand.
    assert.ok(value.startsWith(known.name), value)
    assert.ok(value.includes(known.aaguid), value)
  }
  assert.ok(named > 0, 'no model resolved on a tenant whose keys are approved ones')
})


// A verdict with no reason.
//
// "Passkey registration · Review required" and "Passkey protections · Needs
// correction" rendered with an empty detail on a step where every other tile
// carried one, and What to do read "Fix before continuing: Passkey
// protections: Needs correction. " — a stop and a space with nothing after
// them. Each of these groups is assembled from checks that state why they
// matter (passkeySettings.ts findingsFor, fifth argument) and the group threw
// the sentence away.
test('a passkey verdict that is not a pass says what it is a verdict about', () => {
  let checked = 0
  for (const name of ['midflight', 'hostile', 'messy', 'getiamai', 'large'] as const) {
    const step = runFixture(fixture(name)).steps.find(s => s.id === 's-prereq-passkey-settings')
    if (!step) continue
    for (const f of step.configurationFindings ?? []) {
      if (f.outcome === 'pass') continue
      checked++
      assert.notEqual(f.detail.trim(), '', `${name}/${f.label}: "${f.value}" with no reason`)
      // A reason, not a second list: the group's items carry the evidence.
      assert.ok(f.detail.split('. ').length <= 3, `${name}/${f.label}: the reason is a list`)
    }
  }
  assert.ok(checked > 0, 'no fixture produced a passkey verdict short of a pass')
})

// One step, three channels, three different answers: the tile said "Prepared
// passkeys · Needs correction · ... no phishing-resistant method registered",
// the AI brief said "No account preparation action is currently projected."
// and the portal procedure said "No selected account currently needs
// configuration." Nothing on the card told the reader which to believe.
test('the AI brief never says nothing is projected while a tile says otherwise', () => {
  for (const name of ['getiamai', 'mid', 'midflight', 'demo', 'hostile'] as const) {
    const f = structuredClone(fixture(name))
    const run = runFixture(f)
    const step = run.steps.find(s => s.id === 's-prereq-break-glass')
    if (!step) continue
    const outstanding = (step.configurationFindings ?? []).filter(item => item.outcome !== 'pass')
    const ai = stepBodyOf(step, context(f)).artifacts.find(a => a.id === 'ai')
    assert.ok(ai, `${name}: no AI channel`)
    const text = ai.text()
    if (outstanding.length === 0) continue
    assert.doesNotMatch(text, /No account preparation action is currently projected/, `${name}: ${outstanding.map(i => `${i.label}: ${i.value}`).join('; ')}`)
    // And it names them, so the two channels are the same reading.
    for (const item of outstanding) assert.ok(text.includes(item.label), `${name}: the brief does not mention ${item.label}`)
  }
})

// The configuration procedure says what it is about, because the step has
// another tile that can be asking for a passkey at the same time.
test('the configuration procedure claims nothing wider than the three changes it makes', () => {
  const step = runFixture(structuredClone(fixture('demo'))).steps.find(s => s.id === 's-prereq-break-glass')!
  const text = stepBodyOf(step, context(structuredClone(fixture('demo')))).artifacts.find(a => a.id === 'portal')!.text()
  assert.doesNotMatch(text, /No selected account currently needs configuration/)
})

// R4-35 (Priya D10, Nadia D5). The Prepared passkeys summary lost track of
// which account it was talking about. It composed "account — clause" per item,
// dropped exact repeats and kept the first two, so with both accounts' methods
// unread it read "Break-glass 1 — Missing scan evidence: registered sign-in
// methods. Missing scan evidence: registered sign-in methods." (the second
// account gone, the clause again with nobody attached), and with two findings on
// each of two accounts it named the first account twice and never the second.
// That sentence is all the export and AI Info carry of the card. Each clause is
// said once with every account it is true of, by the sign-in name the rows use.
test('the Prepared passkeys summary names every account a clause is true of, and each clause once', () => {
  const methods = (value: ReturnType<typeof tenant>) => runFixture(value).steps.find(s => s.id === 's-prereq-break-glass')!.configurationFindings!.find(x => x.key === 'recovery-methods')!
  const upn = (value: ReturnType<typeof tenant>, id: string) => value.snapshot.users.find(u => u.id === id)!.userPrincipalName!
  const unread = 'Missing scan evidence: registered sign-in methods.'
  const count = (text: string, part: string) => text.split(part).length - 1

  // Both accounts unread.
  const hostile = structuredClone(fixture('hostile'))
  const [h1, h2] = hostile.mapping.breakGlassUserIds
  assert.deepEqual([hostile.snapshot.authMethods[h1], hostile.snapshot.authMethods[h2]], ['unknown', 'unknown'], 'the premise: neither account was read')
  const both = methods(hostile)
  assert.ok(both.detail.includes(upn(hostile, h1)) && both.detail.includes(upn(hostile, h2)), both.detail)
  assert.equal(count(both.detail, unread), 1, both.detail)
  assert.ok(both.detail.startsWith(upn(hostile, h1)), `an unattributed clause leads: ${both.detail}`)
  // The rows beneath are grouped under the same name the summary uses.
  for (const item of both.items ?? []) if (item.accountId) assert.equal(item.subjectLabel, upn(hostile, item.accountId), JSON.stringify(item))

  // The first account prepared, the second still unread: only the second is named.
  const one = structuredClone(fixture('hostile'))
  one.snapshot.authMethods[h1] = [{ kind: 'fido2', id: 'recovery-key', displayName: 'Recovery key', aaGuid: HARDWARE, passkeyType: 'deviceBound', attestationLevel: 'attested' }]
  const second = methods(one)
  assert.ok(second.detail.startsWith(upn(one, h2)), `the summary does not start with the unread account: ${second.detail}`)
  assert.ok(!second.detail.includes(upn(one, h1)), second.detail)
  assert.equal(count(second.detail, unread), 1, second.detail)

  // Two findings on each of two accounts: both accounts, every clause.
  const shared = tenant()
  const [a, b] = shared.mapping.breakGlassUserIds
  for (const id of [a, b]) shared.snapshot.authMethods[id] = [{ kind: 'microsoftAuthenticator', id: `app-${id}`, displayName: 'SM-S918U' }] as never
  const four = methods(shared)
  const results = reportOf(shared).targets.flatMap(t => t.results).filter(r => r.outcome !== 'pass' && (r.id === 'bg.separateDevices' || r.id === 'bg.phishingResistant'))
  assert.equal(results.length, 4, 'the premise: two open findings on each account')
  for (const r of results) assert.ok(four.detail.includes(r.finding!.replace(/[.]$/, '')), `dropped: ${r.finding}`)
  assert.ok(four.detail.includes(`${upn(shared, a)} and ${upn(shared, b)} — `), `the clause both accounts share names both: ${four.detail}`)
})

// One name per account on the card. The summary and the rows name each account
// by its sign-in name, but the shared-device clause named the other account by
// its display name, so the card read "bg1@… — the Authenticator device
// "SM-S918U" is also registered by Break-glass 2": two names for the second
// account in one sentence, and on a real tenant nothing to say they are the
// same account.
test('the shared-device clause names the other account by the sign-in name the card uses', () => {
  const shared = tenant()
  const [a, b] = shared.mapping.breakGlassUserIds
  for (const id of [a, b]) shared.snapshot.authMethods[id] = [{ kind: 'microsoftAuthenticator', id: `app-${id}`, displayName: 'SM-S918U' }] as never
  const user = (id: string) => shared.snapshot.users.find(u => u.id === id)!
  assert.ok(user(b).displayName && user(b).displayName !== user(b).userPrincipalName, 'the premise: the display name differs from the sign-in name')
  const card = runFixture(shared).steps.find(s => s.id === 's-prereq-break-glass')!.configurationFindings!.find(x => x.key === 'recovery-methods')!
  assert.ok(card.detail.includes(`also registered by ${user(b).userPrincipalName}:`), card.detail)
  assert.ok(card.detail.includes(`also registered by ${user(a).userPrincipalName}:`), card.detail)
  for (const id of [a, b]) assert.ok(!card.detail.includes(user(id).displayName!), `a display name on the card: ${card.detail}`)
})

// R4-56 (Sam D14, Nadia D11). Two readings of emergency-access hardening
// disagreed. The step's tally (step.emergency.hardening, which is what gates,
// lists fix lines, offers Defer and puts a row in Cleanup) counts only the
// account checks; the credential checks — both accounts on one method type,
// accounts sharing an Authenticator device — show on Prepared passkeys as
// "Minimum met · hardening open" and hold nothing. A finished step's lead read
// "Fix these, or defer them: the rollout continues, and they stay in Cleanup
// until they pass" over no defer control, no list and no Cleanup row. The lead
// promises deferral only where the tally has something to defer, and otherwise
// says the rollout does not wait on it and where the recommendation is.
test('a finished emergency step never promises a deferral or a Cleanup row it does not have', () => {
  const f = tenant()
  const run = runFixture(f)
  const step = run.steps.find(s => s.id === 's-prereq-break-glass')!
  assert.equal(step.status, 'done', 'the premise: two approved hardware keys finish the step')
  const methods = step.configurationFindings!.find(x => x.key === 'recovery-methods')!
  assert.equal(methods.value, 'Minimum met · hardening open', 'the premise: a credential recommendation is open')
  const c = stepContract(step, context(f))
  assert.equal(c.hardening, null, 'the premise: the tally has nothing to defer')
  assert.doesNotMatch(c.whatToDo.text, /defer|Cleanup/i, c.whatToDo.text)
  assert.match(c.whatToDo.text, /less resilient than recommended/)
  assert.ok(c.whatToDo.text.includes('Prepared passkeys'), `the lead does not say where the recommendation is: ${c.whatToDo.text}`)
  assert.ok(!(run.schedule.cleanup?.rows ?? []).some(row => row.kind === 'hardening'), 'the premise: no Cleanup row holds it')
})

// The same lead, on a step it is not about. Any finished step with an open
// finding took the emergency-hardening words, so on the Follow-up snapshot
// Configure Passkey Settings, whose open finding is "Existing passkeys affected
// · Could not verify" (ordinary users' passkeys the scan could not read), read
// "Minimum emergency access is available, but less resilient than recommended.
// This does not hold the rollout; see Existing passkeys affected for what would
// make it stronger." The two tiers belong to the step that has them
// (step.emergency, Prepare Emergency Access Accounts alone).
test('the emergency-hardening lead stays on the step that has the two tiers', () => {
  const f = structuredClone(fixture('demo-week2'))
  const run = runFixture(f)
  const step = run.steps.find(s => s.id === 's-prereq-passkey-settings')!
  assert.equal(step.status, 'done', 'the premise: the passkey settings step is finished')
  assert.equal(step.emergency ?? null, null, 'the premise: this step has no emergency tiers')
  assert.ok((step.configurationFindings ?? []).some(x => x.key === 'affected-passkeys' && x.outcome !== 'pass'), 'the premise: an open finding about affected passkeys')
  const text = stepContract(step, context(f)).whatToDo.text
  assert.doesNotMatch(text, /emergency access|less resilient|stronger|defer|Cleanup/i, text)
})

// And no all-clear over a check IAMAI could not make. Taking the emergency
// words away left this step saying its milestone, "No change needed.", over the
// tile "Existing passkeys affected · Could not verify · Some users' registered
// authentication methods were not readable." — the step contradicting the card
// beneath it, and an absolute claim over an impact IAMAI did not read. Where
// every open finding is unread, the lead scopes the all-clear to what was read
// and names the check that was not; with every finding passing it says its
// milestone, as it did.
test('a finished step does not say "No change needed." over a check it could not verify', () => {
  const f = structuredClone(fixture('demo-week2'))
  const run = runFixture(f)
  const step = run.steps.find(s => s.id === 's-prereq-passkey-settings')!
  const open = (step.configurationFindings ?? []).filter(x => x.outcome !== 'pass')
  assert.deepEqual(open.map(x => [x.label, x.outcome]), [['Existing passkeys affected', 'unknown']], 'the premise: one unread finding is open')
  const text = stepContract(step, context(f)).whatToDo.text
  assert.doesNotMatch(text, /^No change needed\.|Nothing left to do\./, text)
  assert.ok(text.includes('could not verify Existing passkeys affected'), `the lead does not name the unread check: ${text}`)
  assert.match(text, /^Nothing IAMAI could read here needs a change\./)

  const passing = { ...step, configurationFindings: (step.configurationFindings ?? []).map(x => ({ ...x, outcome: 'pass' as const })) }
  assert.equal(stepContract(passing, context(f)).whatToDo.text, 'No change needed.')
  // A failing finding is not an unread one: this lead does not speak for it.
  const failing = { ...step, configurationFindings: (step.configurationFindings ?? []).map(x => x.outcome === 'unknown' ? { ...x, outcome: 'fail' as const } : x) }
  assert.doesNotMatch(stepContract(failing, context(f)).whatToDo.text, /could not verify/)
})

// R4-56 (Sam D14, Nadia D11), the words. The method-diversity finding printed
// the Graph kind bare — "Every emergency account relies on fido2 alone.",
// "… relies on microsoftAuthenticator alone." — on the card, the export and AI
// Info. The kind is named as the rest of the product names it.
test('the method-diversity finding names the method type in words, never the Graph kind', () => {
  for (const [kind, words] of [['fido2', 'Passkey or FIDO2 security key'], ['microsoftAuthenticator', 'Microsoft Authenticator'], ['phone', 'Text or call']] as const) {
    const f = tenant()
    for (const id of f.mapping.breakGlassUserIds) f.snapshot.authMethods[id] = kind === 'fido2' ? f.snapshot.authMethods[id] : [{ kind, id: `m-${id}`, displayName: `Device ${id}` }] as never
    const diversity = reportOf(f).targets.flatMap(t => t.results).find(r => r.id === 'bg.methodDiversity')!
    assert.equal(diversity.outcome, 'fail', `the premise: both accounts rely on ${kind}`)
    const detail = journeyAccountFindings(reportOf(f), f.snapshot, f.mapping).find(x => x.key === 'recovery-methods')!.detail
    assert.ok(detail.includes(words), `${kind}: ${detail}`)
    // "\\b", not "\b": inside a template literal "\b" is a backspace character,
    // so this check matched nothing and could never fail.
    assert.doesNotMatch(detail, new RegExp(`\\b${kind}\\b`), `${kind} printed bare: ${detail}`)
  }
})
