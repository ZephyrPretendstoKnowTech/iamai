import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { emergencyMethodFinding, journeyAccountFindings, journeyGroupFindings, journeyPasskeyFindings, journeyRecoveryFindings, recoveryWaitingLine } from './emergencyJourney.ts'
import { emergencyTierOf } from '../validation/emergencyTiers.ts'
import { buildContext, breakGlassReport } from '../validation/report.ts'
import { cleanupRecord, reconcileAutomaticRecovery, recoveryAccountBasis, recoveryCandidateReadings, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import type { RecoveryDirectoryAudit } from '../graph/collect/types.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { PASSKEY_DEFAULT_MODELS } from './passkeySettings.ts'
import { exclusionsGroupIdToVerify } from '../mapping/safetyChoice.ts'

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

test('selected accounts drive method findings; unread methods or partial passkey settings never become missing keys or passes', () => {
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

  // Partial passkey settings stay explicit inside Passkey registration even when other settings pass.
  const partial = tenant()
  const policy = partial.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, any>[] }
  const method = policy.authenticationMethodConfigurations.find(p => p.id === 'Fido2')!
  for (const target of method.includeTargets) delete target.allowedPasskeyProfiles
  const availability = journeyPasskeyFindings(partial.snapshot, partial.mapping, partial.groups).find(t => t.key === 'registration')!
  assert.equal(availability.outcome, 'unknown')
  assert.match(JSON.stringify(availability.items), /allowedPasskeyProfiles/)
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
  assert.equal(recoveryWaitingLine({ at: start, changeObserved: false }, [], null, 'UTC'), 'Sign in with this account’s passkey.\nNo change seen since: Sep 18, 2026, 6:37 PM UTC\nLast sign-in: none seen')
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
  for (const lines of Object.values(scanned)) assert.deepEqual(lines.slice(0, 2), ['Sign in with this account’s passkey.', `No change seen since: ${logStart}`])
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

