// Cleanup completion (E3): a Done records the row's date in the checkpoints and
// the row reads done <date>; the drill's date exempts the matching emergency
// sign-in from the emergency-access step's recent-sign-in check; the naming row
// renders renames as from → to; the consolidation row exists whenever a step's
// existingCoverage line rendered; the not-assessed row's note names the policy
// and the reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { cleanupDoneDates, cleanupRecord, drillDates, isRecordedDrill, latestRecoveryTest, recoveryCandidateReadings, reconcileAutomaticRecovery, withCleanupDone, recoveryAccountBasis, recoveryEvidenceOf, RECOVERY_AUTOMATIC_WORKFLOW, RECOVERY_INVALIDATION_WORKFLOW, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import { recoveryPasskeyCandidateSet } from './passkeyCompatibility.ts'
import { supersededPolicies } from './generate.ts'
import { cleanupWhen } from '../ui/surfaces/cleanupExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { absoluteDate } from '../copy/dates.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'
import { recoveryEvidenceSource } from './cleanupDone.ts'

test('an unread audit or sign-in source suspends recovery proof, without destroying its generation or poisoning unrelated sign-in evidence', () => {
  // audit read failure suspends recovery without poisoning unrelated sign-in evidence
  {
    const f = structuredClone(fixture('demo-week2'))
    const ids = f.mapping.breakGlassUserIds
    const input = { checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: f.snapshot.asOf }
    f.snapshot.recoveryAuditSource = { status: 'error', reason: 'Audit read denied', coveredWindow: null, asOf: f.snapshot.asOf }
    assert.equal(f.snapshot.sources.signInEvidence.status, 'ok')
    assert.equal(recoveryEvidenceSource(f.snapshot).status, 'error')
    assert.equal(reconcileAutomaticRecovery(input).length, 0)
    delete f.snapshot.recoveryAuditSource
    assert.equal(recoveryEvidenceSource(f.snapshot).status, 'error', 'old snapshots need a fresh recovery audit read')
    f.snapshot.recoveryAuditSource = { status: 'ok', reason: null, coveredWindow: null, asOf: f.snapshot.asOf }
    assert.equal(cleanupRecord(reconcileAutomaticRecovery(input)).records!.length, 2)
  }

  // unread evidence suspends current proof without destroying its generation
  {
    const f = structuredClone(fixture('demo-week2'))
    const id = f.mapping.breakGlassUserIds[0]
    const at = f.snapshot.asOf
    const plus = (minutes: number): string => new Date(Date.parse(at) + minutes * 60_000).toISOString()
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: at })
    const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
    Object.assign(event, { eventId: 'post-baseline', at: plus(5), authenticationAt: plus(5), resourceTenantId: f.snapshot.tenantId })
    f.snapshot.asOf = plus(10)
    f.snapshot.sources.signInEvidence = { status: 'ok', reason: null, coveredWindow: { from: plus(-30), to: plus(10) }, asOf: plus(10) }
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: plus(10) })
    const records = cleanupRecord(checkpoints).records!
    const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const set = recoveryPasskeyCandidateSet(f.snapshot, id, f.mapping, f.groups)
    const context = () => ({ readings: recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, at), tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf, signInSource: f.snapshot.sources.signInEvidence, candidateSetBasis: set.state === 'complete' ? JSON.stringify([...set.ids].sort()) : undefined })
    assert.ok(latestRecoveryTest(id, records, f.snapshot.asOf, basis, context()))

    f.snapshot.sources.signInEvidence = { status: 'error', reason: 'temporary read failure', coveredWindow: null, asOf: plus(11) }
    assert.equal(latestRecoveryTest(id, records, plus(11), basis, context()), null, 'cached evidence cannot stay green while the source read failed')
    const methods = f.snapshot.authMethods[id]
    f.snapshot.authMethods[id] = 'unknown'
    const suspended = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: plus(11) })
    assert.equal(suspended, checkpoints, 'an unread required source preserves history without writing an invalidation')
    f.snapshot.authMethods[id] = methods
  }
})

test('the recovery baseline starts at the last recorded change or the completed acquisition, so a passkey sign-in after it counts on the scan that sees it', () => {
  // the completed group acquisition is the boundary for the next qualifying event
  {
    const f = structuredClone(fixture('demo-week2'))
    const id = f.mapping.breakGlassUserIds[0]
    const at = f.snapshot.asOf
    const plus = (minutes: number): string => new Date(Date.parse(at) + minutes * 60000).toISOString()
    const input = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id] }
    const checkpoints = reconcileAutomaticRecovery({ ...input, checkpoints: [], acquisitionCompletedAt: plus(2) })
    assert.equal(cleanupRecord(checkpoints).records![0].configurationObservedAt, plus(2))
    const event = f.snapshot.signInEvidence[id].recoveryCandidates![0]
    Object.assign(event, { eventId: 'during-acquisition', at: plus(1), authenticationAt: plus(1) })
    f.snapshot.asOf = plus(5)
    assert.equal(reconcileAutomaticRecovery({ ...input, checkpoints, acquisitionCompletedAt: plus(5) }), checkpoints)
    Object.assign(event, { eventId: 'after-acquisition', at: plus(3), authenticationAt: plus(3) })
    const verified = reconcileAutomaticRecovery({ ...input, checkpoints, acquisitionCompletedAt: plus(5) })
    assert.equal(cleanupRecord(verified).records!.at(-1)?.outcome, 'passed')
  }

  // the baseline starts at the last recorded change, so a passkey sign-in after it counts on the first scan
  {
    const { f, ids, at, plus, signIn, policyChange, proofs } = anchoredCase()
    f.snapshot.recoveryDirectoryAudits = [policyChange(-120)]
    signIn(0, 'after-change', -60)
    signIn(1, 'before-change', -180)
    const checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    const preparation = cleanupRecord(checkpoints).records!.find(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.accountIds?.includes(ids[0]))!
    assert.equal(preparation.configurationObservedAt, plus(-120))
    assert.equal(preparation.configurationCheckedThrough, at)
    assert.equal(proofs(checkpoints, ids[0]).length, 1, 'signed in after the last change, before IAMAI scanned')
    assert.equal(proofs(checkpoints, ids[1]).length, 0, 'signed in before the last change')
  }

  // after an account change the new baseline starts at the change, and a sign-in before the scan counts on that scan
  // Overnight review B4: after an account or group change, Step 4's start is the
  // change time, not the scan time, so a passkey sign-in between the change and the
  // scan counts (EMERGENCY-ACCESS-HANDOFF Step 4: the last relevant change).
  {
    const { f, ids, at, plus, windows, signIn, proofs } = anchoredCase()
    f.snapshot.recoveryDirectoryAudits = []
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    const first = cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.accountIds?.includes(ids[0])).at(-1)!
    // The account is changed 30 minutes after the first scan, signs in with its passkey 15 minutes later, and IAMAI scans 15 minutes after that.
    f.snapshot.recoveryDirectoryAudits = [{ id: 'audit-account-change', at: plus(30), activity: 'Update user', category: 'UserManagement', result: 'success', targets: [{ id: ids[0], type: 'User' }] }]
    signIn(0, 'between-change-and-scan', 45)
    windows(plus(60))
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(60) })
    const records = cleanupRecord(checkpoints).records!
    const preparation = records.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.accountIds?.includes(ids[0])).at(-1)!
    assert.notEqual(preparation.recoveryGeneration, first.recoveryGeneration, 'the change starts a new generation')
    assert.equal(preparation.configurationObservedAt, plus(30), 'the start is the change time, not the scan at ' + plus(60))
    assert.equal(proofs(checkpoints, ids[0]).filter(record => record.recoveryGeneration === preparation.recoveryGeneration).length, 1, 'the sign-in after the change counts on this scan')
    const { configuredAt } = recoveryEvidenceOf(f.snapshot, f.mapping, f.groups, records, plus(60), ids[0])
    assert.equal(configuredAt, plus(30), 'Step 4 states the change time as the start')
  }
})

test('legacy drill dates and manually confirmed recovery remain history, and never complete automatic verification', () => {
  // legacy drill dates remain history while ordinary cleanup completion still records the latest date
  {
    let cps: unknown[] = [{ at: '2026-09-01T00:00:00.000Z', coverage: [] }]
    cps = withCleanupDone(cps, 'drill', '2026-09-03', '2026-09-03T10:00:00.000Z')
    cps = withCleanupDone(cps, 'naming', '2026-09-04', '2026-09-04T10:00:00.000Z')
    cps = withCleanupDone(cps, 'drill', '2026-12-01', '2026-12-01T10:00:00.000Z')
    assert.equal(cps.length, 4, 'the scan checkpoint stays beside the Cleanup records')
    assert.deepEqual(cleanupDoneDates(cps), { naming: '2026-09-04T12:00:00.000Z' }, 'legacy drill dates remain history rather than current completion')
    assert.deepEqual(drillDates(cps), [], 'untyped drill dates cannot become current recovery proof')
    assert.equal(isRecordedDrill('2026-09-03T02:15:00.000Z', drillDates(cps)), false, 'a legacy date does not identify the tested account')
    assert.ok(!isRecordedDrill('2026-09-05T02:15:00.000Z', drillDates(cps)))
    assert.ok(!isRecordedDrill('2026-09-03T02:15:00.000Z', []))
  }

  // legacy manually confirmed recovery remains history and cannot complete automatic verification
  {
    const f = fixture('demo')
    for (const [index, id] of f.mapping.breakGlassUserIds.entries()) {
      const eventAt = f.snapshot.users.find(user => user.id === id)!.lastSuccessfulSignIn!
      f.snapshot.signInEvidence[id] = { ...(f.snapshot.signInEvidence[id] ?? { signInCount: 1, lastSignIn: eventAt, lastMfaSuccess: null }), recoveryCandidates: [{ schema: 1, eventId: `observed-${index}`, userId: id, at: eventAt, success: true, isInteractive: true, appId: '74658136-14ec-4630-ad9b-26e160ff0fc6', resourceId: '00000003-0000-0000-c000-000000000000', app: 'Microsoft Entra admin center', resource: 'Microsoft Graph', method: 'Passkey (FIDO2)', authenticationAt: eventAt, resourceTenantId: f.snapshot.tenantId, freshMethod: true }] }
    }
    const bgId = f.mapping.breakGlassUserIds[0]
    const signIn = f.snapshot.users.find((u) => u.id === bgId)!.lastSuccessfulSignIn!
    const before = runFixture(f)
    const bg = before.steps.find((s) => s.id === 's-prereq-break-glass')!
    const recent = bg.checks!.items.filter((it) => it.fix === 'recent-sign-in')
    assert.equal(recent.length, 0, 'final recovery evidence does not appear as account-preparation work')

    const accountBasis = recoveryAccountBasis(f.snapshot, f.mapping.breakGlassUserIds, f.mapping, f.groups)
    const configurationObservedAt = new Date(Math.min(...f.mapping.breakGlassUserIds.map(id => Date.parse(f.snapshot.signInEvidence[id]!.recoveryCandidates![0].at))) - 3_600_000).toISOString()
    const recoveryEvidence = Object.fromEntries(f.mapping.breakGlassUserIds.map((id) => { const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]; return [id, { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: event.eventId, eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt } ] }))
    let checkpoints = withCleanupDone([], 'drill', configurationObservedAt.slice(0, 10), configurationObservedAt, { accountIds: f.mapping.breakGlassUserIds, workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: f.snapshot.tenantId, configurationObservedAt, accountBasis, timeZone: 'UTC' })
    checkpoints = withCleanupDone(checkpoints, 'drill', signIn.slice(0, 10), f.snapshot.asOf, { accountIds: f.mapping.breakGlassUserIds, outcome: 'passed', purpose: 'final', accountBasis, recoveryEvidence, signInAtByAccount: Object.fromEntries(f.mapping.breakGlassUserIds.map(id => [id, f.snapshot.users.find(u => u.id === id)!.lastSuccessfulSignIn!])), timeZone: 'UTC' })
    const readings = recoveryCandidateReadings(f.snapshot, bgId, f.snapshot.asOf, configurationObservedAt)
    const evidenceContext = { readings, tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf }
    assert.equal(latestRecoveryTest(bgId, checkpoints as never[], f.snapshot.asOf, accountBasis[bgId], evidenceContext, 'final'), null)
    assert.equal(latestRecoveryTest(bgId, checkpoints as never[], f.snapshot.asOf, accountBasis[bgId], evidenceContext, 'pre-change'), null, 'final proof cannot satisfy the separate pre-change purpose')
    const drilled = runFixture(f, { cleanupRecord: cleanupRecord(checkpoints) })
    const bgAfter = drilled.steps.find((s) => s.id === 's-prereq-break-glass')!
    assert.equal(bgAfter.checks!.items.filter((it) => it.fix === 'recent-sign-in').length, 0, 'final verification does not leak into account preparation after it is recorded')
    const row = drilled.schedule.cleanup!.rows.find((r) => r.kind === 'drill')!
    assert.equal(row.done, null, 'legacy manual assurance does not complete automatic verification')
  }
})

test('fabricated, imported or replayed recovery evidence never completes the drill or clears a confirmed failure', () => {
  // fabricated or imported recovery event ids never complete the drill
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
    const configuredAt = new Date(Date.parse(event.at) - 3_600_000).toISOString()
    const evidence = { [id]: { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: 'fabricated-event-id', eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt: configuredAt } }
    const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)
    let checkpoints = withCleanupDone([], 'drill', configuredAt.slice(0, 10), configuredAt, { accountIds: [id], workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: f.snapshot.tenantId, configurationObservedAt: configuredAt, accountBasis: basis })
    checkpoints = withCleanupDone(checkpoints, 'drill', event.at.slice(0, 10), f.snapshot.asOf, { accountIds: [id], outcome: 'passed', purpose: 'final', accountBasis: basis, recoveryEvidence: evidence })
    const record = cleanupRecord(checkpoints).records!
    const result = runFixture(f, { cleanupRecord: { done: {}, drills: [], records: record } })
    assert.notEqual(result.schedule.cleanup!.rows.find(row => row.kind === 'drill')!.done, event.at.slice(0, 10))
  }

  // an imported automatic assurance marker cannot replace observed event evidence
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
    const baseline = new Date(Date.parse(event.at) - 60_000).toISOString()
    const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)
    const evidence = { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: 'forged', eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, assurance: 'automatic-complete-candidates', configurationObservedAt: baseline }
    let checkpoints = withCleanupDone([], 'drill', baseline.slice(0,10), baseline, { accountIds: [id], purpose: 'final', tenantId: f.snapshot.tenantId, workflow: RECOVERY_PREPARATION_WORKFLOW, configurationObservedAt: baseline, accountBasis: basis })
    checkpoints = withCleanupDone(checkpoints, 'drill', event.at.slice(0,10), f.snapshot.asOf, { accountIds: [id], purpose: 'final', outcome: 'passed', accountBasis: basis, recoveryEvidence: { [id]: evidence } })
    assert.equal(latestRecoveryTest(id, cleanupRecord(checkpoints).records!, f.snapshot.asOf, basis[id], { readings: [], tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf }), null)
  }

  // a confirmed failure cannot be cleared by recording an older successful event again
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
    const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const failureAt = new Date(Date.parse(event.at) + 60_000).toISOString()
    let checkpoints = withCleanupDone(f.checkpoints ?? [], 'drill', failureAt.slice(0,10), failureAt, { purpose: 'final', outcome: 'failed', accountIds: [id] })
    const oldPass = cleanupRecord(f.checkpoints ?? []).records!.find(r => r.outcome === 'passed')!
    checkpoints = [...checkpoints, { ...oldPass, at: f.snapshot.asOf }]
    const context = { readings: recoveryCandidateReadings(f.snapshot, id), tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf }
    assert.equal(latestRecoveryTest(id, cleanupRecord(checkpoints).records!, f.snapshot.asOf, basis, context), null)
  }
})

test('the recovery basis changes with what the emergency account\'s recovery depends on, and with nothing else', () => {
  // recovery basis changes with effective exclusions membership and saved approved-model intent
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    f.mapping.passkeyApprovedModels = [{ name: 'Approved recovery model', aaguid: '11111111-2222-4333-8444-555555555555' }]
    const original = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]?.resolvedId
    assert.ok(original && groupId)
    f.groups.get(groupId!)!.memberIds.push('unexpected-member')
    assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], original)
    f.groups.get(groupId!)!.memberIds.pop()
    f.mapping.passkeyApprovedModels = [{ name: 'Renamed model label', aaguid: '11111111-2222-4333-8444-555555555555' }]
    assert.equal(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], original, 'a model label rename is not a security change')
    f.mapping.passkeyApprovedModels = [{ name: 'Renamed model label', aaguid: '22222222-2222-4333-8444-555555555555' }]
    assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], original)
  }

  // recovery basis invalidates identity and direct group shape changes without treating a display rename as drift
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const before = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const user = f.snapshot.users.find(user => user.id === id)!
    user.displayName = 'Display-only rename'
    assert.equal(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
    user.userPrincipalName = 'changed@demo-fixture.onmicrosoft.com'
    assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
    const next = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
    f.groups.get(groupId)!.directMemberIds = ['unexpected-nested-group']
    assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], next)
  }

  // recovery basis ignores an unrelated group-targeted policy edit
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const groupTemplate = structuredClone([...f.groups.values()][0])
    f.groups.set('unrelated-group', { ...groupTemplate, memberIds: [], memberCount: 0, directMemberIds: [] })
    const policies = f.snapshot.config.caPolicies.rows as Record<string, any>[]
    policies.push({ id: 'unrelated-policy', displayName: 'Unrelated policy', state: 'enabled', conditions: { users: { includeUsers: [], includeGroups: ['unrelated-group'], excludeUsers: [], excludeGroups: [] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null })
    const before = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    policies.at(-1)!.sessionControls = { signInFrequency: { value: 1, type: 'hours' } }
    assert.equal(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
  }

  // recovery basis follows the outcome for the account: an excluded policy is no change, losing the exclusion is
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
    const policies = f.snapshot.config.caPolicies.rows as Record<string, any>[]
    policies.push({ id: 'rollout-policy', displayName: 'Rollout policy', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: ['All'], includeGroups: [], excludeUsers: [], excludeGroups: [groupId] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null })
    const before = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const rollout = policies.at(-1)!
    // Routine rollout of a policy that excludes the emergency accounts: enable it, change its controls.
    rollout.state = 'enabled'
    rollout.grantControls = { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } }
    assert.equal(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
    // The same policy no longer excluding them is a recovery change.
    rollout.conditions.users.excludeGroups = []
    assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
  }

  // recovery basis ignores a passkey-policy change for other users
  {
    const f = fixture('demo-week2')
    const id = f.mapping.breakGlassUserIds[0]
    const before = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
    const row = f.snapshot.config.authMethodsPolicy.rows[0] as Record<string, any>
    const fido = row.fido2Configuration ?? row.authenticationMethodConfigurations.find((c: Record<string, unknown>) => String(c.id).toLowerCase() === 'fido2')
    const lists = [fido.keyRestrictions, ...(fido.passkeyProfiles ?? []).map((p: Record<string, any>) => p.keyRestrictions)].filter((kr: any) => Array.isArray(kr?.aaGuids))
    assert.ok(lists.length > 0)
    for (const kr of lists) kr.aaGuids.push('2fc0579f-8113-47ea-b116-bb5a8db9202a')
    assert.equal(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before, 'the account keeps the same usable approved passkeys')
  }
})

test('the consolidation row exists whenever a step\'s existingCoverage line rendered, and names those policies', () => {
  let seen = false
  // The large fixture holds a compliant-device policy that partly covers its goal: the one step with existing coverage still to do.
  for (const name of ['demo', 'mid', 'large'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const superseded = supersededPolicies(r.steps)
    const row = r.schedule.cleanup?.rows.find((x) => x.kind === 'consolidation') ?? null
    if (superseded.length === 0) continue
    seen = true
    assert.ok(row, `${name}: a step found existing coverage, so the consolidation row exists`)
    for (const s of superseded) assert.ok(row!.lists.overlaps.some(line => line.startsWith(s)), `${name}: the row names ${s}`)
    // The line renders on those steps and on no done step (its policies are what makes it In place).
    for (const s of r.steps) {
      const ex = stepVars(s, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }) as { existingPolicies: string[] }
      if (s.status === 'done') assert.equal(ex.existingPolicies.length, 0, `${name}: ${s.id} is In place; nothing to consolidate`)
      else if (ex.existingPolicies.length > 0 && (s.kind === 'create' || s.kind === 'adjust')) assert.ok(superseded.includes(ex.existingPolicies.join(', ')), `${name}: ${s.id}'s coverage is on the row`)
    }
  }
  assert.ok(seen, 'a fixture has a step with existing coverage')
})

test('unassessed baseline policies become individual reviews, with no catch-all completion', () => {
  const r = runFixture(fixture('demo'))
  assert.equal(r.schedule.cleanup!.rows.some((x) => (x.kind as string) === 'notAssessed'), false)
  const reviews = r.steps.filter((s) => s.id.startsWith('s-review-baseline-'))
  assert.equal(reviews.length, r.coverage.organisation.notAssessed.filter(p => !/IAC\s*-\s*AGENT\s*-\s*BLOCK\s*-\s*(HighRiskAgent|NonTrustedAgents)/i.test(p.name)).length)
  assert.ok(reviews.every((s) => s.guidance?.doneWhen && (s.manualReview || s.configurationFindings?.some(f => f.key === 'avd-allowed-population' && f.outcome === 'unknown'))))
  const avd = reviews.find(s => s.configurationFindings?.some(f => f.key === 'avd-allowed-population'))!
  assert.equal(avd.state.satisfied, false, 'an unresolved allowed-user definition is not verified protection')
  assert.equal(avd.manualReview, undefined, 'generic acknowledgement cannot clear the source gate')
  assert.ok(r.steps.some(s => s.id === 's-goal-inforcer-mfa'), 'Inforcer uses its ordinary application-scoped goal')
  assert.ok(!reviews.some(s => /inforcer/i.test(s.id)), 'the old Inforcer review is not duplicated')
})

test('recovery rejects wrong resource tenant, pre-baseline authentication, reused claims and client-only target matches', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const original = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const baseline = new Date(Date.parse(original.at) - 60_000).toISOString()
  for (const change of [
    { resourceTenantId: 'another-tenant' },
    { authenticationAt: baseline },
    { authenticationAt: 'invalid' },
    { at: baseline },
    { freshMethod: false },
  ]) {
    f.snapshot.signInEvidence[id]!.recoveryCandidates = [{ ...original, ...change }]
    assert.equal(recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, baseline)[0].qualifies, false, JSON.stringify(change))
  }
  f.snapshot.signInEvidence[id]!.recoveryCandidates = [{ ...original, resourceTenantId: f.snapshot.tenantId, authenticationAt: original.at }]
  assert.equal(recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, baseline)[0].qualifies, true)
  // Where the account signed in is not the proof; how is. A fresh passkey sign-in to the Azure portal counts.
  f.snapshot.signInEvidence[id]!.recoveryCandidates = [{ ...original, resourceTenantId: f.snapshot.tenantId, authenticationAt: original.at, appId: 'c44b4083-3bb0-49c1-b47d-974e53cbdf3c', resourceId: '797f4846-ba00-4fd7-ba43-dac1f8f63013' }]
  assert.equal(recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, baseline)[0].qualifies, true)
})

test('automatic recovery establishes a baseline, verifies accounts independently, and keeps retained proof', () => {
  const f = structuredClone(fixture('demo-week2'))
  const ids = f.mapping.breakGlassUserIds
  const plus = (iso: string, minutes: number): string => new Date(Date.parse(iso) + minutes * 60_000).toISOString()
  const baselineAt = f.snapshot.asOf
  let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: baselineAt })
  let records = cleanupRecord(checkpoints).records!
  assert.equal(records.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW).length, ids.length)
  assert.equal(records.some(record => record.workflow === RECOVERY_AUTOMATIC_WORKFLOW), false, 'an event from before the baseline cannot pass on the baseline scan')

  const firstEventAt = plus(baselineAt, 5)
  f.snapshot.asOf = plus(baselineAt, 10)
  f.snapshot.sources.signInEvidence = { status: 'ok', reason: null, coveredWindow: { from: plus(baselineAt, -30), to: f.snapshot.asOf }, asOf: f.snapshot.asOf }
  f.snapshot.signInEvidence[ids[0]]!.recoveryCandidates = [{ ...f.snapshot.signInEvidence[ids[0]]!.recoveryCandidates![0], eventId: 'automatic-first', at: firstEventAt, authenticationAt: firstEventAt, resourceTenantId: f.snapshot.tenantId }]
  checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: f.snapshot.asOf })
  records = cleanupRecord(checkpoints).records!
  assert.equal(records.filter(record => record.workflow === RECOVERY_AUTOMATIC_WORKFLOW).length, 1)

  const secondEventAt = plus(baselineAt, 15)
  f.snapshot.asOf = plus(baselineAt, 20)
  f.snapshot.sources.signInEvidence = { status: 'ok', reason: null, coveredWindow: { from: plus(baselineAt, -30), to: f.snapshot.asOf }, asOf: f.snapshot.asOf }
  f.snapshot.signInEvidence[ids[1]]!.recoveryCandidates = [{ ...f.snapshot.signInEvidence[ids[1]]!.recoveryCandidates![0], eventId: 'automatic-second', at: secondEventAt, authenticationAt: secondEventAt, resourceTenantId: f.snapshot.tenantId }]
  checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: f.snapshot.asOf })
  records = cleanupRecord(checkpoints).records!
  assert.equal(records.filter(record => record.workflow === RECOVERY_AUTOMATIC_WORKFLOW).length, 2)
  const unchanged = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: f.snapshot.asOf })
  assert.equal(unchanged, checkpoints, 'an unchanged scan does not append duplicate checkpoints')

  for (const id of ids) {
    const set = recoveryPasskeyCandidateSet(f.snapshot, id, f.mapping, f.groups)
    const preparation = records.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.accountIds?.includes(id)).at(-1)!
    const context = { readings: recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, preparation.configurationObservedAt), tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf, signInSource: f.snapshot.sources.signInEvidence, candidateSetBasis: set.state === 'complete' ? JSON.stringify([...set.ids].sort()) : undefined }
    assert.ok(latestRecoveryTest(id, records, f.snapshot.asOf, recoveryAccountBasis(f.snapshot, ids, f.mapping, f.groups)[id], context))
  }

  const firstProof = records.find(record => record.workflow === RECOVERY_AUTOMATIC_WORKFLOW && record.accountIds?.includes(ids[0]))!.recoveryEvidence![ids[0]]
  f.snapshot.signInEvidence[ids[0]]!.recoveryCandidates = []
  f.snapshot.asOf = plus(baselineAt, 30)
  f.snapshot.sources.signInEvidence = { status: 'ok', reason: null, coveredWindow: { from: plus(firstProof.eventAt, 1), to: f.snapshot.asOf }, asOf: f.snapshot.asOf }
  const firstSet = recoveryPasskeyCandidateSet(f.snapshot, ids[0], f.mapping, f.groups)
  assert.ok(latestRecoveryTest(ids[0], records, f.snapshot.asOf, recoveryAccountBasis(f.snapshot, ids, f.mapping, f.groups)[ids[0]], { readings: [], tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf, signInSource: f.snapshot.sources.signInEvidence, candidateSetBasis: firstSet.state === 'complete' ? JSON.stringify([...firstSet.ids].sort()) : undefined }), 'proof remains current after the provider retention window moves past its event')
  assert.equal(latestRecoveryTest(ids[0], records, plus(firstProof.eventAt, 91 * 24 * 60), recoveryAccountBasis(f.snapshot, ids, f.mapping, f.groups)[ids[0]], { readings: [], tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: plus(firstProof.eventAt, 91 * 24 * 60), signInSource: f.snapshot.sources.signInEvidence, candidateSetBasis: firstSet.state === 'complete' ? JSON.stringify([...firstSet.ids].sort()) : undefined }), null, 'proof expires after 90 days')
})

test('automatic recovery waits for complete passkey evidence and the final policy, resets after drift, and keeps account generations independent', () => {
  // automatic recovery refuses incomplete passkey evidence and resets after configuration drift
  {
    const f = structuredClone(fixture('demo-week2'))
    const ids = f.mapping.breakGlassUserIds
    const id = ids[0]
    const baselineAt = f.snapshot.asOf
    const originalMethods = structuredClone(f.snapshot.authMethods[id])
    f.snapshot.authMethods[id] = 'unknown'
    const none = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: baselineAt })
    assert.equal(cleanupRecord(none).records!.length, 0)

    f.snapshot.authMethods[id] = originalMethods
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: baselineAt })
    const methods = f.snapshot.authMethods[id]
    if (!Array.isArray(methods)) throw new Error('fixture passkeys unavailable')
    const passkey = methods.find(method => method.kind === 'fido2' || method.kind === 'passkey')!
    const originalAaguid = passkey.aaGuid
    passkey.aaGuid = '11111111-2222-4333-8444-555555555555'
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: new Date(Date.parse(baselineAt) + 60_000).toISOString() })
    assert.equal(cleanupRecord(checkpoints).records!.at(-1)?.workflow, RECOVERY_INVALIDATION_WORKFLOW)
    passkey.aaGuid = originalAaguid
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: [id], acquisitionCompletedAt: new Date(Date.parse(baselineAt) + 120_000).toISOString() })
    assert.equal(cleanupRecord(checkpoints).records!.at(-1)?.workflow, RECOVERY_PREPARATION_WORKFLOW, 'change-and-revert creates a new baseline rather than reviving old proof')
  }

  // automatic recovery waits for the final policy and keeps account generations independent
  {
    const f = structuredClone(fixture('demo-week2'))
    const ids = f.mapping.breakGlassUserIds
    const at = f.snapshot.asOf
    const policy = f.snapshot.config.authMethodsPolicy.rows[0] as Record<string, any>
    const fido = policy.fido2Configuration ?? policy.authenticationMethodConfigurations.find((row: Record<string, unknown>) => String(row.id).toLowerCase() === 'fido2')
    const restrictions = structuredClone(fido.keyRestrictions)
    fido.keyRestrictions = { isEnforced: false, enforcementType: 'allow', aaGuids: [] }
    assert.equal(cleanupRecord(reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })).records!.length, 0, 'unfinished Step 3 cannot establish a baseline')
    fido.keyRestrictions = restrictions
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    assert.equal(cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW).length, 2)

    f.snapshot.users.find(user => user.id === ids[0])!.accountEnabled = false
    const later = new Date(Date.parse(at) + 60_000).toISOString()
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: later })
    const invalidated = cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_INVALIDATION_WORKFLOW)
    assert.deepEqual(invalidated.map(record => record.accountIds?.[0]), [ids[0]], 'an account-only change invalidates only that account')
  }
})

test('an account or shared-group audit change starts a new generation for the accounts it touches; a policy audit event resets nothing', () => {
  // observed relevant audit changes create new generations without resetting unrelated accounts
  {
    const f = structuredClone(fixture('demo-week2'))
    const ids = f.mapping.breakGlassUserIds
    const at = f.snapshot.asOf
    const plus = (seconds: number): string => new Date(Date.parse(at) + seconds * 1000).toISOString()
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    f.snapshot.recoveryDirectoryAudits = [{ id: 'audit-account-a', at: plus(30), activity: 'Update user', category: 'UserManagement', result: 'success', targets: [{ id: ids[0], type: 'User' }] }]
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(60) })
    let records = cleanupRecord(checkpoints).records!
    assert.equal(records.filter(record => record.workflow === RECOVERY_INVALIDATION_WORKFLOW && record.accountIds?.includes(ids[0])).length, 1)
    assert.equal(records.filter(record => record.workflow === RECOVERY_INVALIDATION_WORKFLOW && record.accountIds?.includes(ids[1])).length, 0)

    const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
    f.snapshot.recoveryDirectoryAudits.push({ id: 'audit-shared-group', at: plus(90), activity: 'Update group', category: 'GroupManagement', result: 'success', targets: [{ id: groupId, type: 'Group' }] })
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(120) })
    records = cleanupRecord(checkpoints).records!
    assert.equal(records.filter(record => record.workflow === RECOVERY_INVALIDATION_WORKFLOW && record.accountIds?.includes(ids[1])).length, 1, 'a shared group change resets the other account too')
  }

  // a Conditional Access policy audit event does not reset recovery proof; an account event does
  {
    const f = structuredClone(fixture('demo-week2'))
    const ids = f.mapping.breakGlassUserIds
    const at = f.snapshot.asOf
    const plus = (seconds: number): string => new Date(Date.parse(at) + seconds * 1000).toISOString()
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    const policyId = String((f.snapshot.config.caPolicies.rows[0] as Record<string, unknown>).id)
    f.snapshot.recoveryDirectoryAudits = [
      { id: 'audit-policy', at: plus(30), activity: 'Update conditional access policy', category: 'Policy', result: 'success', targets: [{ id: policyId, type: 'Policy' }] },
      { id: 'audit-passkey-policy', at: plus(31), activity: 'Update authentication methods policy', category: 'Policy', result: 'success', targets: [{ id: 'Fido2', type: 'Policy' }] },
    ]
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(60) })
    assert.equal(cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_INVALIDATION_WORKFLOW).length, 0)
    f.snapshot.recoveryDirectoryAudits.push({ id: 'audit-account', at: plus(90), activity: 'Update user', category: 'UserManagement', result: 'success', targets: [{ id: ids[0], type: 'User' }] })
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(120) })
    assert.equal(cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_INVALIDATION_WORKFLOW && record.accountIds?.includes(ids[0])).length, 1)
  }
})

/** demo-week2 with a readable 30-day audit window and sign-in window ending at `at`, as the collector returns them. */
function anchoredCase() {
  const f = structuredClone(fixture('demo-week2'))
  const ids = f.mapping.breakGlassUserIds
  const at = f.snapshot.asOf
  const plus = (minutes: number): string => new Date(Date.parse(at) + minutes * 60_000).toISOString()
  const windows = (now: string) => {
    f.snapshot.asOf = now
    f.snapshot.recoveryAuditSource = { status: 'ok', reason: null, coveredWindow: { from: plus(-30 * 24 * 60), to: now }, asOf: now }
    f.snapshot.sources.signInEvidence = { status: 'ok', reason: null, coveredWindow: { from: plus(-30 * 24 * 60), to: now }, asOf: now }
  }
  windows(at)
  const signIn = (index: number, eventId: string, minutes: number) => {
    const template = fixture('demo-week2').snapshot.signInEvidence[ids[index]]!.recoveryCandidates![0]
    f.snapshot.signInEvidence[ids[index]]!.recoveryCandidates = [{ ...template, eventId, at: plus(minutes), authenticationAt: plus(minutes), resourceTenantId: f.snapshot.tenantId }]
  }
  const policyId = String((f.snapshot.config.caPolicies.rows[0] as Record<string, unknown>).id)
  const policyChange = (minutes: number) => ({ id: `audit-policy-${minutes}`, at: plus(minutes), activity: 'Update conditional access policy', category: 'Policy', result: 'success', targets: [{ id: policyId, type: 'Policy' }] })
  const proofs = (checkpoints: unknown[], id: string) => cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_AUTOMATIC_WORKFLOW && record.accountIds?.includes(id))
  return { f, ids, at, plus, windows, signIn, policyChange, proofs }
}

test('a late audit entry moves the baseline forward and retires earlier proof; an unproved scan-time baseline moves back to the last change, and routine later edits do not move it', () => {
  // a late audit entry inside the baseline window moves its start forward and retires earlier proof
  {
    const { f, ids, at, plus, windows, signIn, policyChange, proofs } = anchoredCase()
    f.snapshot.recoveryDirectoryAudits = []
    signIn(0, 'early', -60)
    let checkpoints = reconcileAutomaticRecovery({ checkpoints: [], snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
    const first = proofs(checkpoints, ids[0])
    assert.equal(first.length, 1)
    // The next scan's audit read includes a change made before the first scan that had not arrived yet.
    windows(plus(60))
    f.snapshot.recoveryDirectoryAudits = [policyChange(-30)]
    checkpoints = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(60) })
    const records = cleanupRecord(checkpoints).records!
    const preparation = records.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.accountIds?.includes(ids[0])).at(-1)!
    assert.equal(preparation.configurationObservedAt, plus(-30))
    assert.notEqual(preparation.recoveryGeneration, first[0].recoveryGeneration, 'the earlier proof belongs to a retired generation')
    assert.equal(proofs(checkpoints, ids[0]).filter(record => record.recoveryGeneration === preparation.recoveryGeneration).length, 0)
    // Unchanged audit on a further scan: the start stays put, no churn.
    const again = reconcileAutomaticRecovery({ checkpoints, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(90) })
    assert.equal(again, checkpoints)
  }

  // an unproved baseline set at scan time moves back to the last change; routine later policy edits do not move it
  {
    const { f, ids, at, plus, windows, signIn, policyChange, proofs } = anchoredCase()
    // A baseline recorded by the earlier rule: start = scan time, no checked-through mark.
    const legacy = reconcileAutomaticRecovery({ checkpoints: [], snapshot: { ...f.snapshot, recoveryAuditSource: { ...f.snapshot.recoveryAuditSource!, coveredWindow: null } }, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: at })
      .map(record => { const { configurationCheckedThrough: _mark, ...rest } = record as Record<string, unknown>; return rest })
    f.snapshot.recoveryDirectoryAudits = [policyChange(-240), policyChange(30)]
    signIn(0, 'before-scan', -60)
    windows(plus(45))
    const checkpoints = reconcileAutomaticRecovery({ checkpoints: legacy, snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, accountIds: ids, acquisitionCompletedAt: plus(45) })
    const preparation = cleanupRecord(checkpoints).records!.filter(record => record.workflow === RECOVERY_PREPARATION_WORKFLOW && record.accountIds?.includes(ids[0])).at(-1)!
    assert.equal(preparation.configurationObservedAt, plus(-240), 'the last change up to the original baseline scan')
    assert.equal(proofs(checkpoints, ids[0]).length, 1, 'a sign-in before that scan now counts; the edit after it does not reset anything')
  }
})
